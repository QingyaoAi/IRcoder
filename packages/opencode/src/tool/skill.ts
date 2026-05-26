import path from "path"
import { pathToFileURL } from "url"
import { Effect, Schema } from "effect"
import * as Stream from "effect/Stream"
import { InstanceState } from "@/effect/instance-state"
import * as Process from "@/util/process"
import * as Log from "@opencode-ai/core/util/log"
import { Ripgrep } from "../file/ripgrep"
import { Skill } from "../skill"
import { Retrieval } from "../skill/retrieval"
import * as Tool from "./tool"
import DESCRIPTION from "./skill.txt"

const log = Log.create({ service: "tool.skill" })

export const Parameters = Schema.Struct({
  name: Schema.String.annotate({
    description:
      "The name of the skill to load. May be either a locally-installed skill or a skill returned by a recent `skill_search` call (in which case it will be installed on demand).",
  }),
})

type ResolvedInstall = {
  owner: string
  repo: string
  skill: string
}

// API returns `skill_id` in the form "owner/repo@skill". Extract the three pieces
// so we can shape an `npx skills add` invocation. Returns undefined for any shape
// the contract didn't promise — we'd rather fail loudly than install something wrong.
function parseSkillId(skillId: string): ResolvedInstall | undefined {
  const atIdx = skillId.lastIndexOf("@")
  if (atIdx <= 0 || atIdx >= skillId.length - 1) return undefined
  const repoPart = skillId.slice(0, atIdx)
  const skillName = skillId.slice(atIdx + 1)
  const slash = repoPart.indexOf("/")
  if (slash <= 0 || slash >= repoPart.length - 1) return undefined
  const owner = repoPart.slice(0, slash)
  const repo = repoPart.slice(slash + 1)
  if (!owner || !repo || !skillName) return undefined
  if (repoPart.indexOf("/", slash + 1) !== -1) return undefined // reject deeper paths
  return { owner, repo, skill: skillName }
}

export const SkillTool = Tool.define(
  "skill",
  Effect.gen(function* () {
    const skill = yield* Skill.Service
    const retrieval = yield* Retrieval.Service
    const rg = yield* Ripgrep.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          let info = yield* skill.get(params.name)

          if (!info) {
            const hit = yield* retrieval.lookup(params.name)
            if (hit) {
              const resolved = parseSkillId(hit.skill_id)
              if (!resolved) {
                yield* Effect.die(
                  new Error(
                    `Skill "${params.name}" was returned by skill_search but its skill_id "${hit.skill_id}" did not parse as owner/repo@skill; cannot install.`,
                  ),
                )
              } else {
                const repoUrl = `https://github.com/${resolved.owner}/${resolved.repo}`
                yield* ctx.ask({
                  permission: "skill_install",
                  patterns: [`${resolved.owner}/${resolved.repo}@${resolved.skill}`],
                  always: [`${resolved.owner}/${resolved.repo}@${resolved.skill}`],
                  metadata: {
                    skill_id: hit.skill_id,
                    name: params.name,
                    repo: repoUrl,
                  },
                })

                const instance = yield* InstanceState.context
                const cmd = ["npx", "-y", "skills", "add", repoUrl, "--skill", resolved.skill, "-y"]
                log.info("installing skill", { cmd, cwd: instance.worktree })

                const result = yield* Effect.tryPromise({
                  try: () =>
                    Process.run(cmd, {
                      cwd: instance.worktree,
                      abort: ctx.abort,
                      nothrow: true,
                    }),
                  catch: (err) => err,
                }).pipe(
                  Effect.catch((err) =>
                    Effect.die(new Error(`Failed to invoke npx skills add: ${(err as Error)?.message ?? err}`)),
                  ),
                )

                if (result.code !== 0) {
                  yield* Effect.die(
                    new Error(
                      `npx skills add ${repoUrl} --skill ${resolved.skill} failed (exit ${result.code}):\n${result.stderr.toString().trim() || result.stdout.toString().trim()}`,
                    ),
                  )
                }

                yield* skill.refresh()
                info = yield* skill.get(params.name)
              }
            }
          }

          // Fall back to the original NotFoundError when we still can't resolve the skill —
          // either retrieval had no hit, or the install completed without producing a SKILL.md
          // that disk discovery picked up under the requested name.
          if (!info) {
            yield* skill
              .require(params.name)
              .pipe(Effect.catchTag("Skill.NotFoundError", (error) => Effect.die(new Error(error.message))))
            return yield* Effect.die(new Error(`Skill "${params.name}" could not be resolved.`))
          }

          yield* ctx.ask({
            permission: "skill",
            patterns: [params.name],
            always: [params.name],
            metadata: {},
          })

          const dir = path.dirname(info.location)
          const base = pathToFileURL(dir).href
          const limit = 10
          const files = yield* rg.files({ cwd: dir, follow: false, hidden: true, signal: ctx.abort }).pipe(
            Stream.filter((file) => !file.includes("SKILL.md")),
            Stream.map((file) => path.resolve(dir, file)),
            Stream.take(limit),
            Stream.runCollect,
            Effect.map((chunk) => [...chunk].map((file) => `<file>${file}</file>`).join("\n")),
          )

          return {
            title: `Loaded skill: ${info.name}`,
            output: [
              `<skill_content name="${info.name}">`,
              `# Skill: ${info.name}`,
              "",
              info.content.trim(),
              "",
              `Base directory for this skill: ${base}`,
              "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
              "Note: file list is sampled.",
              "",
              "<skill_files>",
              files,
              "</skill_files>",
              "</skill_content>",
            ].join("\n"),
            metadata: {
              name: info.name,
              dir,
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
