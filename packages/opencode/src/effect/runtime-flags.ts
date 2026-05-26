import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("IRCODER_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@ircoder/RuntimeFlags", {
  autoShare: bool("IRCODER_AUTO_SHARE"),
  pure: bool("IRCODER_PURE"),
  disableDefaultPlugins: bool("IRCODER_DISABLE_DEFAULT_PLUGINS"),
  disableChannelDb: bool("IRCODER_DISABLE_CHANNEL_DB"),
  disableEmbeddedWebUi: bool("IRCODER_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("IRCODER_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("IRCODER_DISABLE_LSP_DOWNLOAD"),
  skipMigrations: bool("IRCODER_SKIP_MIGRATIONS"),
  disableClaudeCodePrompt: Config.all({
    broad: bool("IRCODER_DISABLE_CLAUDE_CODE"),
    direct: bool("IRCODER_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("IRCODER_DISABLE_CLAUDE_CODE"),
    direct: bool("IRCODER_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("IRCODER_ENABLE_EXA"),
    legacy: bool("IRCODER_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("IRCODER_ENABLE_PARALLEL"),
    legacy: bool("IRCODER_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("IRCODER_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("IRCODER_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("IRCODER_EXPERIMENTAL_SCOUT"),
  experimentalBackgroundSubagents: enabledByExperimental("IRCODER_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  experimentalLspTy: bool("IRCODER_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("IRCODER_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("IRCODER_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("IRCODER_EXPERIMENTAL_PLAN_MODE"),
  experimentalEventSystem: enabledByExperimental("IRCODER_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalWorkspaces: enabledByExperimental("IRCODER_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("IRCODER_EXPERIMENTAL_ICON_DISCOVERY"),
  acpNext: bool("IRCODER_ACP_NEXT"),
  outputTokenMax: positiveInteger("IRCODER_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("IRCODER_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("IRCODER_EXPERIMENTAL_NATIVE_LLM"),
  client: Config.string("IRCODER_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.defaultLayer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const defaultLayer = Service.defaultLayer.pipe(Layer.orDie)

export * as RuntimeFlags from "./runtime-flags"
