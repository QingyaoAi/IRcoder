import { Schema } from "effect"

export const Retrieval = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean).annotate({
    description:
      "Enable the remote skill retrieval API. When true (default), skills are discovered via the search service; when false, fall back to enumerating all locally-installed skills in the system prompt.",
  }),
  url: Schema.optional(Schema.String).annotate({
    description: "Override the base URL of the skill retrieval API. Defaults to https://skills.megatechai.com/.",
  }),
  topK: Schema.optional(Schema.Number).annotate({
    description: "Number of results to request from the retrieval API per search. Defaults to 10.",
  }),
})

export type Retrieval = Schema.Schema.Type<typeof Retrieval>

export const Info = Schema.Struct({
  paths: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Additional paths to skill folders",
  }),
  urls: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "URLs to fetch skills from (e.g., https://example.com/.well-known/skills/)",
  }),
  retrieval: Schema.optional(Retrieval).annotate({
    description: "Settings for the remote skill retrieval API used to discover skills on demand.",
  }),
})

export type Info = Schema.Schema.Type<typeof Info>

export * as ConfigSkills from "./skills"
