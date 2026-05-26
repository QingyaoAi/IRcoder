import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const IRCODER_EXPERIMENTAL = truthy("IRCODER_EXPERIMENTAL")
const copy = process.env["IRCODER_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? IRCODER_EXPERIMENTAL : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  IRCODER_AUTO_HEAP_SNAPSHOT: truthy("IRCODER_AUTO_HEAP_SNAPSHOT"),
  IRCODER_GIT_BASH_PATH: process.env["IRCODER_GIT_BASH_PATH"],
  IRCODER_CONFIG: process.env["IRCODER_CONFIG"],
  IRCODER_CONFIG_CONTENT: process.env["IRCODER_CONFIG_CONTENT"],
  IRCODER_DISABLE_AUTOUPDATE: truthy("IRCODER_DISABLE_AUTOUPDATE"),
  IRCODER_ALWAYS_NOTIFY_UPDATE: truthy("IRCODER_ALWAYS_NOTIFY_UPDATE"),
  IRCODER_DISABLE_PRUNE: truthy("IRCODER_DISABLE_PRUNE"),
  IRCODER_DISABLE_TERMINAL_TITLE: truthy("IRCODER_DISABLE_TERMINAL_TITLE"),
  IRCODER_SHOW_TTFD: truthy("IRCODER_SHOW_TTFD"),
  IRCODER_DISABLE_AUTOCOMPACT: truthy("IRCODER_DISABLE_AUTOCOMPACT"),
  IRCODER_DISABLE_MODELS_FETCH: truthy("IRCODER_DISABLE_MODELS_FETCH"),
  IRCODER_DISABLE_MOUSE: truthy("IRCODER_DISABLE_MOUSE"),
  IRCODER_FAKE_VCS: process.env["IRCODER_FAKE_VCS"],
  IRCODER_SERVER_PASSWORD: process.env["IRCODER_SERVER_PASSWORD"],
  IRCODER_SERVER_USERNAME: process.env["IRCODER_SERVER_USERNAME"],

  // Experimental
  IRCODER_EXPERIMENTAL_FILEWATCHER: Config.boolean("IRCODER_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  IRCODER_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("IRCODER_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  IRCODER_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("IRCODER_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  IRCODER_MODELS_URL: process.env["IRCODER_MODELS_URL"],
  IRCODER_MODELS_PATH: process.env["IRCODER_MODELS_PATH"],
  IRCODER_DB: process.env["IRCODER_DB"],

  IRCODER_WORKSPACE_ID: process.env["IRCODER_WORKSPACE_ID"],
  IRCODER_EXPERIMENTAL_WORKSPACES: enabledByExperimental("IRCODER_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get IRCODER_DISABLE_PROJECT_CONFIG() {
    return truthy("IRCODER_DISABLE_PROJECT_CONFIG")
  },
  get IRCODER_TUI_CONFIG() {
    return process.env["IRCODER_TUI_CONFIG"]
  },
  get IRCODER_CONFIG_DIR() {
    return process.env["IRCODER_CONFIG_DIR"]
  },
  get IRCODER_PURE() {
    return truthy("IRCODER_PURE")
  },
  get IRCODER_PERMISSION() {
    return process.env["IRCODER_PERMISSION"]
  },
  get IRCODER_PLUGIN_META_FILE() {
    return process.env["IRCODER_PLUGIN_META_FILE"]
  },
  get IRCODER_CLIENT() {
    return process.env["IRCODER_CLIENT"] ?? "cli"
  },
}
