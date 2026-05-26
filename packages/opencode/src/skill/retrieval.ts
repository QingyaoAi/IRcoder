import { Context, Effect, Layer, Schema, SynchronizedRef } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { withTransientReadRetry } from "@/util/effect-http-client"
import { InstanceState } from "@/effect/instance-state"
import { Config } from "@/config/config"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "skill-retrieval" })

const DEFAULT_URL = "https://skills.megatechai.com/"
const DEFAULT_TOP_K = 10
const DEFAULT_CANDIDATE_K = 200
const DEFAULT_QUALITY_WEIGHT = 0.1

export class Hit extends Schema.Class<Hit>("SkillRetrievalHit")({
  skill_id: Schema.String,
  repo: Schema.optional(Schema.String),
  name: Schema.String,
  description: Schema.optional(Schema.String),
  when_to_use: Schema.optional(Schema.Array(Schema.String)),
  weekly_installs_num: Schema.optional(Schema.Number),
  github_stars_num: Schema.optional(Schema.Number),
  final_score: Schema.optional(Schema.Number),
}) {}

export class Response extends Schema.Class<Response>("SkillRetrievalResponse")({
  search_id: Schema.String,
  retrieval_session_id: Schema.String,
  results: Schema.Array(Hit),
}) {}

export class RetrievalError extends Schema.TaggedErrorClass<RetrievalError>()("Skill.RetrievalError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export type QueryFields = {
  name?: string
  description?: string
  when_to_use?: string
  sections?: string
}

export type SearchInput = {
  originQuery: string
  queryFields: QueryFields
  topK?: number
  clarification?: { text?: string }
}

type State = {
  sessionId: SynchronizedRef.SynchronizedRef<string | undefined>
  lastSearchId: SynchronizedRef.SynchronizedRef<string | undefined>
  lastResults: SynchronizedRef.SynchronizedRef<Map<string, Hit>>
}

export interface Interface {
  readonly enabled: () => Effect.Effect<boolean>
  readonly search: (input: SearchInput) => Effect.Effect<Response, RetrievalError>
  readonly lookup: (name: string) => Effect.Effect<Hit | undefined>
  readonly lastResults: () => Effect.Effect<readonly Hit[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SkillRetrieval") {}

function defaultWeights(fields: QueryFields) {
  // Mirror the contract's recommended defaults but zero out fields the caller didn't supply
  // so the unused signals don't dilute ranking.
  const weights = {
    name: fields.name ? 0.1 : 0,
    description: fields.description ? 0.6 : 0,
    when_to_use: fields.when_to_use ? 0.2 : 0,
    sections: fields.sections ? 0.1 : 0,
  }
  const total = weights.name + weights.description + weights.when_to_use + weights.sections
  if (total === 0) {
    // Fall back to description-dominant defaults if caller passed only origin_query.
    return { name: 0.1, description: 0.6, when_to_use: 0.2, sections: 0.1 }
  }
  // Normalize so weights sum to 1 — the API doesn't require this but it keeps scores comparable.
  return {
    name: weights.name / total,
    description: weights.description / total,
    when_to_use: weights.when_to_use / total,
    sections: weights.sections / total,
  }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const http = HttpClient.filterStatusOk(withTransientReadRetry(yield* HttpClient.HttpClient))

    const state = yield* InstanceState.make<State>(
      Effect.fn("SkillRetrieval.state")(function* () {
        return {
          sessionId: yield* SynchronizedRef.make<string | undefined>(undefined),
          lastSearchId: yield* SynchronizedRef.make<string | undefined>(undefined),
          lastResults: yield* SynchronizedRef.make(new Map<string, Hit>()),
        }
      }),
    )

    const settings = Effect.fn("SkillRetrieval.settings")(function* () {
      const cfg = yield* config.get()
      const r = cfg.skills?.retrieval
      const enabled = r?.enabled ?? true
      const baseUrl = (r?.url ?? DEFAULT_URL).endsWith("/") ? (r?.url ?? DEFAULT_URL) : `${r?.url ?? DEFAULT_URL}/`
      const topK = r?.topK ?? DEFAULT_TOP_K
      return { enabled, baseUrl, topK }
    })

    const enabled: Interface["enabled"] = Effect.fn("SkillRetrieval.enabled")(function* () {
      return (yield* settings()).enabled
    })

    const search: Interface["search"] = Effect.fn("SkillRetrieval.search")(function* (input) {
      const { baseUrl, topK } = yield* settings()
      const s = yield* InstanceState.get(state)

      const existingSession = yield* SynchronizedRef.get(s.sessionId)
      const sessionId = existingSession ?? crypto.randomUUID()
      if (!existingSession) yield* SynchronizedRef.set(s.sessionId, sessionId)

      const parentSearchId = yield* SynchronizedRef.get(s.lastSearchId)
      const round = parentSearchId ? 2 : 1
      const clarificationUsed = Boolean(parentSearchId && input.clarification?.text)

      const payload = {
        origin_query: input.originQuery,
        query_fields: {
          name: input.queryFields.name ?? "",
          description: input.queryFields.description ?? "",
          when_to_use: input.queryFields.when_to_use ?? "",
          sections: input.queryFields.sections ?? "",
        },
        weights: defaultWeights(input.queryFields),
        top_k: input.topK ?? topK,
        candidate_k: DEFAULT_CANDIDATE_K,
        quality_weight: DEFAULT_QUALITY_WEIGHT,
        retrieval_session_id: sessionId,
        round,
        ...(parentSearchId ? { parent_search_id: parentSearchId } : {}),
        clarification_used: clarificationUsed,
        ...(clarificationUsed && input.clarification?.text
          ? { clarification_text: input.clarification.text }
          : {}),
        consent_granted: true,
      }

      const url = new URL("search_multi_field", baseUrl).href

      const response = yield* HttpClientRequest.post(url).pipe(
        HttpClientRequest.acceptJson,
        HttpClientRequest.bodyJson(payload),
        Effect.flatMap((req) => http.execute(req)),
        Effect.flatMap(HttpClientResponse.schemaBodyJson(Response)),
        Effect.catch((cause) =>
          Effect.gen(function* () {
            log.error("search failed", { url, cause })
            return yield* new RetrievalError({ message: "Skill retrieval request failed", cause })
          }),
        ),
      )

      yield* SynchronizedRef.set(s.lastSearchId, response.search_id)
      // Keep the session id we generated; the contract says reuse the same id across rounds.
      // The server echoes its own value in the response but we don't adopt it as our local truth.
      yield* SynchronizedRef.set(
        s.lastResults,
        new Map(response.results.map((hit) => [hit.name, hit])),
      )

      return response
    })

    const lookup: Interface["lookup"] = Effect.fn("SkillRetrieval.lookup")(function* (name: string) {
      const s = yield* InstanceState.get(state)
      const map = yield* SynchronizedRef.get(s.lastResults)
      return map.get(name)
    })

    const lastResults: Interface["lastResults"] = Effect.fn("SkillRetrieval.lastResults")(function* () {
      const s = yield* InstanceState.get(state)
      const map = yield* SynchronizedRef.get(s.lastResults)
      return Array.from(map.values())
    })

    return Service.of({ enabled, search, lookup, lastResults })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Config.defaultLayer),
  Layer.provide(FetchHttpClient.layer),
)

export * as Retrieval from "./retrieval"
