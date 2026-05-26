import { Effect, Schema } from "effect"
import { Retrieval } from "../skill/retrieval"
import { Skill } from "../skill"
import * as Tool from "./tool"
import DESCRIPTION from "./skill_search.txt"

export const Parameters = Schema.Struct({
  query: Schema.String.annotate({
    description: "Free-form description of what the user is trying to accomplish. The strongest signal for retrieval.",
  }),
  when_to_use: Schema.optional(Schema.String).annotate({
    description: "Optional triggering scenario (e.g. 'after the user uploads a PDF'). Refines retrieval.",
  }),
  name_hint: Schema.optional(Schema.String).annotate({
    description: "Optional short capability label if you have one in mind (e.g. 'pdf', 'docx').",
  }),
})

export const SkillSearchTool = Tool.define(
  "skill_search",
  Effect.gen(function* () {
    const retrieval = yield* Retrieval.Service
    const skill = yield* Skill.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, _ctx: Tool.Context): Effect.Effect<Tool.ExecuteResult> =>
        Effect.gen(function* () {
          if (!(yield* retrieval.enabled())) {
            return {
              title: "Skill search disabled",
              output:
                "Skill retrieval is disabled in this project's config (skills.retrieval.enabled = false). The skill tool can still load locally-installed skills by name.",
              metadata: { disabled: true },
            }
          }

          const response = yield* retrieval
            .search({
              originQuery: params.query,
              queryFields: {
                name: params.name_hint,
                description: params.query,
                when_to_use: params.when_to_use,
              },
            })
            .pipe(
              Effect.catchTag("Skill.RetrievalError", (error) =>
                Effect.succeed({
                  search_id: "",
                  retrieval_session_id: "",
                  results: [] as ReadonlyArray<{
                    skill_id: string
                    name: string
                    description?: string
                    when_to_use?: ReadonlyArray<string>
                    github_stars_num?: number
                  }>,
                  _error: error.message,
                } as const),
              ),
            )

          if ("_error" in response) {
            return {
              title: "Skill search failed",
              output: `The skill retrieval API returned an error: ${response._error}\nFall back to loading locally-installed skills by name with the \`skill\` tool, or proceed without a skill.`,
              metadata: { failed: true },
            }
          }

          if (response.results.length === 0) {
            return {
              title: "No skills matched",
              output:
                "No skills matched this query. Refine the description and try again, or proceed without a skill.",
              metadata: { count: 0 },
            }
          }

          const localNames = new Set((yield* skill.all()).map((info) => info.name))

          const lines: string[] = ["<skill_search_results>"]
          for (const hit of response.results) {
            const installed = localNames.has(hit.name)
            lines.push("  <skill>")
            lines.push(`    <name>${hit.name}</name>`)
            lines.push(`    <skill_id>${hit.skill_id}</skill_id>`)
            if (hit.description) lines.push(`    <description>${hit.description}</description>`)
            if (hit.when_to_use?.length) {
              lines.push(`    <when_to_use>${hit.when_to_use.join("; ")}</when_to_use>`)
            }
            if (typeof hit.github_stars_num === "number") {
              lines.push(`    <github_stars>${hit.github_stars_num}</github_stars>`)
            }
            lines.push(`    <installed>${installed}</installed>`)
            lines.push("  </skill>")
          }
          lines.push("</skill_search_results>")
          lines.push("")
          lines.push(
            "Use the `skill` tool with `name=<...>` to load one of these. Skills marked installed=false will be installed on first load (subject to user permission).",
          )

          return {
            title: `Found ${response.results.length} skill${response.results.length === 1 ? "" : "s"}`,
            output: lines.join("\n"),
            metadata: {
              count: response.results.length,
              search_id: response.search_id,
              session_id: response.retrieval_session_id,
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
