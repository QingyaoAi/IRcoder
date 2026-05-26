import { Layer } from "effect"
import { TuiConfig } from "./config/tui"
import { Npm } from "@ircoder/core/npm"
import { Observability } from "@ircoder/core/effect/observability"

export const CliLayer = Observability.layer.pipe(Layer.merge(TuiConfig.layer), Layer.provide(Npm.defaultLayer))
