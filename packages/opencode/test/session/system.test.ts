import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import type { Agent } from "../../src/agent/agent"
import { NamedError } from "@ircoder/core/util/error"
import { Skill } from "../../src/skill"
import { Retrieval } from "../../src/skill/retrieval"
import { Permission } from "../../src/permission"
import { SystemPrompt } from "../../src/session/system"
import { testEffect } from "../lib/effect"

const skills: Skill.Info[] = [
  {
    name: "zeta-skill",
    description: "Zeta skill.",
    location: "/tmp/zeta-skill/SKILL.md",
    content: "# zeta-skill",
  },
  {
    name: "alpha-skill",
    description: "Alpha skill.",
    location: "/tmp/alpha-skill/SKILL.md",
    content: "# alpha-skill",
  },
  {
    name: "middle-skill",
    description: "Middle skill.",
    location: "/tmp/middle-skill/SKILL.md",
    content: "# middle-skill",
  },
  {
    name: "manual-skill",
    location: "/tmp/manual-skill/SKILL.md",
    content: "# manual-skill",
  },
]

const build: Agent.Info = {
  name: "build",
  mode: "primary",
  permission: Permission.fromConfig({ "*": "allow" }),
  options: {},
}

// This test asserts the enumeration path (alpha/middle/zeta sort order embedded in the prompt),
// so we force retrieval off — when retrieval is on, the prompt no longer lists skills.
const fakeSkill = Layer.succeed(
  Skill.Service,
  Skill.Service.of({
    get: (name) => Effect.succeed(skills.find((skill) => skill.name === name)),
    require: (name) => {
      const info = skills.find((skill) => skill.name === name)
      if (info) return Effect.succeed(info)
      return Effect.fail(new Skill.NotFoundError({ name, available: skills.map((skill) => skill.name) }))
    },
    all: () => Effect.succeed(skills),
    dirs: () => Effect.succeed([]),
    available: () => Effect.succeed(skills),
    refresh: () => Effect.void,
  }),
)

const fakeRetrieval = Layer.succeed(
  Retrieval.Service,
  Retrieval.Service.of({
    enabled: () => Effect.succeed(false),
    search: () =>
      Effect.die(new Error("retrieval search should not be invoked when enabled() returns false")),
    lookup: () => Effect.succeed(undefined),
    lastResults: () => Effect.succeed([]),
  }),
)

const it = testEffect(SystemPrompt.layer.pipe(Layer.provide(fakeSkill), Layer.provide(fakeRetrieval)))

const fakeRetrievalEnabled = Layer.succeed(
  Retrieval.Service,
  Retrieval.Service.of({
    enabled: () => Effect.succeed(true),
    search: () => Effect.die(new Error("not used in this test")),
    lookup: () => Effect.succeed(undefined),
    lastResults: () => Effect.succeed([]),
  }),
)

const itRetrieval = testEffect(
  SystemPrompt.layer.pipe(Layer.provide(fakeSkill), Layer.provide(fakeRetrievalEnabled)),
)

describe("session.system", () => {
  it.effect("skills output is sorted by name and stable across calls", () =>
    Effect.gen(function* () {
      const prompt = yield* SystemPrompt.Service
      const first = yield* prompt.skills(build)
      const second = yield* prompt.skills(build)
      const output = first ?? (yield* Effect.fail(new NamedError.Unknown({ message: "missing skills output" })))

      expect(first).toBe(second)

      const alpha = output.indexOf("<name>alpha-skill</name>")
      const middle = output.indexOf("<name>middle-skill</name>")
      const zeta = output.indexOf("<name>zeta-skill</name>")

      expect(alpha).toBeGreaterThan(-1)
      expect(middle).toBeGreaterThan(alpha)
      expect(zeta).toBeGreaterThan(middle)
      expect(output).not.toContain("manual-skill")
    }),
  )

  itRetrieval.effect("skills output omits enumeration when retrieval is enabled", () =>
    Effect.gen(function* () {
      const prompt = yield* SystemPrompt.Service
      const output = yield* prompt.skills(build)
      expect(output).toBeDefined()
      expect(output).not.toContain("alpha-skill")
      expect(output).not.toContain("middle-skill")
      expect(output).not.toContain("zeta-skill")
      expect(output).toContain("skill_search")
    }),
  )
})
