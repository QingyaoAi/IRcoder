import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"
import { Retrieval } from "../../src/skill/retrieval"
import { Config } from "../../src/config/config"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { provideTmpdirInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const node = CrossSpawnSpawner.defaultLayer

type CapturedRequest = {
  url: string
  method: string
  body: any
}

function decodeBody(body: unknown): any {
  if (!body || typeof body !== "object") return undefined
  const tag = (body as { _tag?: string })._tag
  if (tag === "Uint8Array") {
    const bytes = (body as { body: Uint8Array }).body
    const text = new TextDecoder().decode(bytes)
    return text ? JSON.parse(text) : undefined
  }
  return undefined
}

function mockClient(captured: CapturedRequest[], responseBody: unknown, status = 200) {
  return HttpClient.make((request) =>
    Effect.sync(() => {
      captured.push({
        url: request.url,
        method: request.method,
        body: decodeBody(request.body),
      })
      return HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(responseBody), {
          status,
          headers: { "content-type": "application/json" },
        }),
      )
    }),
  )
}

function harness(captured: CapturedRequest[], responseBody: unknown, status = 200) {
  return testEffect(
    Layer.mergeAll(
      Retrieval.layer.pipe(
        Layer.provide(Config.defaultLayer),
        Layer.provide(Layer.succeed(HttpClient.HttpClient, mockClient(captured, responseBody, status))),
      ),
      node,
    ),
  )
}

describe("Skill.Retrieval", () => {
  const sampleResponse = {
    search_id: "search-1",
    retrieval_session_id: "session-1",
    results: [
      {
        skill_id: "anthropics/skills@pdf",
        repo: "skills",
        name: "pdf",
        description: "Work with PDFs",
        when_to_use: ["when reading or producing a PDF"],
        weekly_installs_num: 100,
        github_stars_num: 1234,
        final_score: 0.91,
      },
      {
        skill_id: "anthropics/skills@docx",
        name: "docx",
        description: "Work with Word documents",
        github_stars_num: 500,
      },
    ],
  }

  const captured1: CapturedRequest[] = []
  const it1 = harness(captured1, sampleResponse)

  it1.live("posts a structured query and exposes the results", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const retrieval = yield* Retrieval.Service
          expect(yield* retrieval.enabled()).toBe(true)

          const result = yield* retrieval.search({
            originQuery: "extract text from a PDF",
            queryFields: { description: "extract text from a PDF" },
          })

          expect(result.search_id).toBe("search-1")
          expect(result.results).toHaveLength(2)
          expect(result.results[0].name).toBe("pdf")
          expect(result.results[0].github_stars_num).toBe(1234)

          expect(captured1).toHaveLength(1)
          const req = captured1[0]
          expect(req.method).toBe("POST")
          expect(req.url).toContain("search_multi_field")
          expect(req.body.origin_query).toBe("extract text from a PDF")
          expect(req.body.query_fields.description).toBe("extract text from a PDF")
          expect(req.body.round).toBe(1)
          expect(req.body.consent_granted).toBe(true)
          expect(typeof req.body.retrieval_session_id).toBe("string")

          const hit = yield* retrieval.lookup("pdf")
          expect(hit?.skill_id).toBe("anthropics/skills@pdf")

          const last = yield* retrieval.lastResults()
          expect(last.map((h) => h.name).sort()).toEqual(["docx", "pdf"])
        }),
      { git: true },
    ),
  )

  const captured2: CapturedRequest[] = []
  const it2 = harness(captured2, sampleResponse)

  it2.live("reuses the session id and sets parent_search_id on the second round", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const retrieval = yield* Retrieval.Service
          yield* retrieval.search({
            originQuery: "extract text from a PDF",
            queryFields: { description: "extract text from a PDF" },
          })
          yield* retrieval.search({
            originQuery: "extract text from a PDF",
            queryFields: { description: "merge two PDFs and add page numbers" },
            clarification: { text: "user clarified they want to merge" },
          })

          expect(captured2).toHaveLength(2)
          expect(captured2[0].body.round).toBe(1)
          expect(captured2[1].body.round).toBe(2)
          expect(captured2[1].body.parent_search_id).toBe("search-1")
          expect(captured2[1].body.clarification_used).toBe(true)
          expect(captured2[1].body.clarification_text).toBe("user clarified they want to merge")
          expect(captured2[1].body.retrieval_session_id).toBe(captured2[0].body.retrieval_session_id)
        }),
      { git: true },
    ),
  )

  const captured3: CapturedRequest[] = []
  const it3 = harness(captured3, sampleResponse, 500)

  it3.live("returns a RetrievalError when the API fails", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const retrieval = yield* Retrieval.Service
          const error = yield* Effect.flip(
            retrieval.search({
              originQuery: "anything",
              queryFields: { description: "anything" },
            }),
          )
          expect(error._tag).toBe("Skill.RetrievalError")
        }),
      { git: true },
    ),
  )

  const captured4: CapturedRequest[] = []
  const it4 = testEffect(
    Layer.mergeAll(
      Retrieval.layer.pipe(
        Layer.provide(Config.defaultLayer),
        Layer.provide(Layer.succeed(HttpClient.HttpClient, mockClient(captured4, sampleResponse))),
      ),
      node,
    ),
  )

  it4.live("respects skills.retrieval.enabled = false", () =>
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const retrieval = yield* Retrieval.Service
          expect(yield* retrieval.enabled()).toBe(false)
        }),
      { git: true, config: { skills: { retrieval: { enabled: false } } } },
    ),
  )
})
