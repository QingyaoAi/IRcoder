# Development Plan: Replace skill enumeration with skill-grep retrieval

## 1. Goal & locked-in decisions

* **Scope:** Replace prompt-level skill enumeration only. On-disk discovery in [packages/ircoder/src/skill/index.ts:173-233](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/skill/index.ts#L173-L233) stays as-is and continues to load any skill already installed on disk.
* **Install flow:** When the retrieval API returns a skill not present locally, shell out to `npx skills add https://github.com/<owner>/<repo> --skill <name>` (gated by a permission ask), then load it. `npx skills add` writes to `.claude/skills/` or `.agents/skills/` (project-level by default, or `~/.claude/skills/` etc. with `-g`), both of which the existing discovery already scans — so post-install we just need to refresh the cached state.
* **Feedback:** `POST /feedback` is out of scope for this iteration. Code path will be stubbed with a TODO so it can be wired up later without re-plumbing.

## 2. Current architecture (1-page summary)

* [`Skill.Service`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/skill/index.ts#L96-L102) — eagerly discovers all SKILL.md files at first access from: `~/.claude/skills`, `~/.agents/skills`, project-walked `.claude/skills` and `.agents/skills`, config'd `.ircoder/{skill,skills}`, plus `config.skills.paths` and `config.skills.urls`. Plus one built-in `customize-ircoder`. State is cached via `InstanceState.make`.

* [`Skill.fmt(list, { verbose })`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/skill/index.ts#L326-L351) — formats every available skill into a block.

* [`SystemPrompt.skills`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/session/system.ts#L65-L77) — calls `skill.available(agent)` and dumps the **verbose** list into the system prompt.

* [`ToolRegistry.describeSkill`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/tool/registry.ts#L282-L299) — appends the **terse** list to the `skill` tool's description.

* [`SkillTool`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/tool/skill.ts) — takes `{ name }`, calls `skill.require(name)`, returns rendered SKILL content.

* Other consumers (unchanged, still keyed off `Skill.Service`):

  * [`Command.layer`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/command/index.ts#L141-L152) exposes each skill as a slash command.
  * [`Agent.layer`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/agent/agent.ts#L88-L100) uses `skill.dirs()` for the permission whitelist.
  * [`InstanceHttpApi`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/server/routes/instance/httpapi/handlers/instance.ts#L84-L86) exposes `skill.all()` for the TUI skill dialog ([dialog-skill.tsx](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/cli/cmd/tui/component/dialog-skill.tsx#L15-L18)).
  * [`debug skill`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/cli/cmd/debug/skill.ts) CLI dump.

## 3. Target architecture

* The system prompt and `skill` tool description **stop enumerating skills**. The agent learns about skills only through the **search tool's description** + retrieval results.
* A new tool, **`skill_search`**, calls the skill-grep API. Each result includes a `skill_id` (`owner/repo@name`), `name`, `description`, `when_to_use`, and `github_stars_num`.
* After search, the agent loads a skill with the existing **`skill`** tool. The tool gains a new code path: if the requested name isn't in `Skill.Service`, it consults a small in-memory "last search results" cache, resolves the install target, asks for permission, runs `npx skills add`, invalidates state, and re-loads.
* Already-installed local skills (built-in `customize-ircoder`, any disk skill) keep working transparently.

## 4. New module: skill-grep API client

**New file:** `packages/ircoder/src/skill/retrieval.ts`

* An Effect `Service` exposing:

  * `search(input: { originQuery: string; queryFields: {...}; round?: 1|2; parentSearchId?: string; clarification?: { used: boolean; text?: string } }) => Effect<SearchResult>`
  * `lastResults() => Effect<Map<name, SearchHit>>` — the most recent results, indexed by skill `name`, for cross-tool lookup (used by the `skill` tool to resolve install info).

* Uses `HttpClient.HttpClient` (already pulled in [tool/registry.ts:36](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/tool/registry.ts#L36)) and `withTransientReadRetry` from [util/effect-http-client](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/util/effect-http-client.ts), following the pattern in [skill/discovery.ts:34](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/skill/discovery.ts#L34).

* `Schema.Class` definitions for the request envelope and response (`search_id`, `retrieval_session_id`, `results[]`).

* Session state (held in `InstanceState`):

  * `retrieval_session_id` (uuid, generated lazily on first call)
  * `last_search_id` (for `parent_search_id` on a follow-up clarification round)
  * `last_results: Map<name, SearchHit>`

* Base URL from a new config field (`config.skills.retrieval.url`, defaulting to `https://skills.megatechai.com/`). Hard-coding the URL is acceptable for the first pass but a config override avoids re-shipping for endpoint changes.

* Errors: typed `SkillRetrievalError` (HTTP, schema, empty results) carrying enough context to surface a useful message to the model.

## 5. New tool: `skill_search`

**New file:** `packages/ircoder/src/tool/skill_search.ts` plus `packages/ircoder/src/tool/skill_search.txt`.

* Parameters (Schema):

  * `query: string` — the user/task intent, free-form
  * `description?: string` — optional structured "main problem" field (strongest signal per the contract)
  * `when_to_use?: string` — optional triggering scenario

* Execute: builds the `POST /search_multi_field` payload (round=1, `clarification_used=false`, `consent_granted=true`), stores `search_id` and results into retrieval state, returns a compact summary block:
  ```
  <skill_search_results>
    <skill skill_id="..." name="..." stars="...">
      <description>...</description>
      <when_to_use>...</when_to_use>
      <installed>true|false</installed>
    </skill>
    ...
  </skill_search_results>
  Use the `skill` tool with `name=<...>` to load one of these. Skills marked installed=false will be installed on first load.
  ```

* The description (in `skill_search.txt`) tells the model: when a task looks like it could use a specialized skill, call `skill_search` first; pass a focused description of the task.

* Wired in [tool/registry.ts:225-266](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/tool/registry.ts#L225-L266) alongside the other builtins.

## 6. Skill tool changes (`packages/ircoder/src/tool/skill.ts`)

* Keep the same `{ name }` parameter — the agent's mental model stays the same.

* New flow:

  1. `info = yield* skill.get(name)` (note: `get`, not `require`, so a miss is a normal branch instead of a defect).

  2. If `info` exists → unchanged path (permission ask + render).

  3. If not → consult `Retrieval.lastResults()` for a hit with this `name`.

     * No hit → fall back to the existing `require` failure with the typed `NotFoundError` (preserves current UX for "model invented a skill name").
     * Hit → look up `skill_id` (`owner/repo@skill`), ask for a new permission (`"skill_install"`), shell out to `npx skills add https://github.com/<owner>/<repo> --skill <skill>` (project-level by default; `-y` to skip prompts), then **invalidate** the cached `Skill.Service` state and retry the lookup.

* New permission key `skill_install` so users can pre-approve repos/skills (similar to how `skill` works today). Defaults to `ask`.

## 7. State invalidation after install

* `Skill.Service` caches both `discovered` and `state` via `InstanceState.make`. After a successful `npx skills add`, call `InstanceState.invalidate(discovered)` + `InstanceState.invalidate(state)` so the next `get/require` rescans disk and picks up the freshly-installed SKILL.md.
* Surface this as a new method on `Skill.Interface`: `refresh(): Effect<void>`. Cleaner than the `skill` tool reaching into internals.

## 8. System prompt change (`packages/ircoder/src/session/system.ts`)

* Replace the `Skill.fmt(list, { verbose: true })` block with a short static instruction:

  > Skills provide specialized workflows. Use `skill_search` to discover skills relevant to the task, then use `skill` to load one. Skills already installed locally can also be loaded directly by name if you know it.

* Drop the per-skill dump entirely. The `Permission.disabled(["skill"], …)` early-return still applies.

* Mirror the change in `ToolRegistry.describeSkill` — stop calling `skill.available(...)`; just describe the load-by-name contract. (`skill_search` gets its own description.)

## 9. Config additions (`packages/ircoder/src/config/skills.ts`)

```ts
retrieval: Schema.optional(Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),          // default true; set false to revert to enumeration
  url:     Schema.optional(Schema.String),           // override base URL
  topK:    Schema.optional(Schema.Number),           // default 10
}))
```

The `enabled: false` escape hatch is important for two reasons: it gives users an offline/airgapped mode, and it gives us a one-line revert if the API misbehaves in the field.

## 10. What does **not** change

* [command/index.ts:141-152](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/command/index.ts#L141-L152) (skills-as-commands) — still iterates `skill.all()`, which only contains locally-installed skills. Fine.
* [agent/agent.ts:88-100](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/agent/agent.ts#L88-L100) (`skill.dirs()` for permission whitelist) — disk-based; fine.
* [server/routes/.../instance.ts:84-86](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/server/routes/instance/httpapi/handlers/instance.ts#L84-L86) and the [TUI skill dialog](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/cli/cmd/tui/component/dialog-skill.tsx) — still list locally-installed skills. Optional follow-up: expose `skill_search` here too, but out of scope.
* Built-in `customize-ircoder` skill — preregistered in state, unaffected.

## 11. Phased work breakdown

**Phase 1 — Retrieval client (no behavior change yet)**

* Add `config/skills.ts` retrieval struct.
* Add `skill/retrieval.ts` (service + schemas + session state).
* Unit test the request/response shapes (use a mocked `HttpClient`, like other client tests do).

**Phase 2 — `skill_search` tool**

* Add `tool/skill_search.ts` + `.txt`.
* Wire into [`tool/registry.ts`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/tool/registry.ts) (provide `Retrieval.Service`, add to the `tool` Effect.all, add to `builtin` array, add to `defaultLayer`).
* Tests against the live API can be gated behind an env var; default to mock.

**Phase 3 — Auto-install path in `skill` tool**

* Add `refresh()` to `Skill.Interface`.
* In `tool/skill.ts`, branch on `skill.get(name)` miss: resolve from retrieval state → permission ask `skill_install` → `npx skills add ... -y` (use `ChildProcessSpawner` or the existing shell helpers — match how other tools shell out) → `skill.refresh()` → re-`require`. Stream the install output back to the model only on failure.
* Add `skill_install` permission to the default config in [agent/agent.ts](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/agent/agent.ts).

**Phase 4 — Drop enumeration from prompts**

* Strip skill enumeration from [`SystemPrompt.skills`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/session/system.ts#L65-L77) and from [`ToolRegistry.describeSkill`](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/ircoder/src/tool/registry.ts#L282-L299). Replace with a short static instruction.
* Gate behind `config.skills.retrieval.enabled !== false` so users can opt out.

**Phase 5 — Tests & docs**

* New tests under `packages/ircoder/test/skill/`: retrieval client (mocked), `skill_search` tool, install-on-miss path (mock the spawner).
* Update existing `skill.test.ts` if any assertions depend on prompt enumeration (none do today — they all hit `Skill.Service` directly, so this should be a no-op).
* Update [packages/web/src/content/docs/skills.mdx](vscode-webview://1tpkqiu7hie782hju67om8b32ajuib7dc3aa0vi62grm5sev89v7/packages/web/src/content/docs/skills.mdx) (and translations only if maintained — most repos let those drift; check policy).

## 12. Risks & open questions

1. **`skill_id` → install URL mapping.** The API returns `skill_id: "owner/repo@skill"`. The plan assumes `https://github.com/<owner>/<repo>`. The skill-grep spec only shows GitHub examples, but if non-GitHub origins are ever returned we'll need a source URL in the response. Worth confirming with the API owner before shipping.
2. **Permission UX for `npx` spawn.** Installing a skill is essentially running arbitrary repo code (post-install hooks, etc.). The permission ask must clearly show the repo and skill name. Consider also a config allowlist of trusted GitHub orgs.
3. **Cold start latency.** Every "agent that might use a skill" now eats an HTTP round-trip before it can load one. Mitigation: only call `skill_search` when the model judges it relevant (this is in the tool description), and cache results within a session.
4. **Clarification round.** The skill-grep contract supports a round-2 retrieval with clarification. The plan does **not** implement that yet — the model can just call `skill_search` again with a refined query. If retrieval quality is poor we can add a `clarification` parameter later without breaking the existing tool shape.
5. **Telemetry / feedback (deferred).** Skipping feedback per your decision, but the retrieval service should still return and store `search_id` and `retrieval_session_id` so feedback can be added later without re-plumbing.
6. **Web/TUI dialog.** The TUI's "Skills" dialog will only show locally-installed skills (no behavior change). If you want the dialog to also offer search, that's a separate follow-up.

