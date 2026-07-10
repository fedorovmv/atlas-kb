# Brief: OpenCode plugin lifecycle — memory guard

## Goal

Scaffold `.opencode/plugins/memory-guard.js` — OpenCode plugin with lifecycle hooks: auto-inject memory context on first user message, enforce memory read before write tool calls.

## Scope (LIMITATIONS §4.9, v0.4 — 2 из 4 пунктов)

1. **plugin lifecycle** — `.opencode/plugins/memory-guard.js` scaffolded into target project. Uses `@opencode-ai/plugin` Plugin type + Hooks.
2. **automatic pre-task memory context injection** — `chat.message` hook: on first user message in session, auto-run `npm run memory -- context <query>` and inject result into message parts.
3. **enforcement: read memory before write** — `tool.execute.before` hook: intercept `Write`/`Edit`/`ast_grep_replace` tool calls. Check if memory tools (`context`, `related`, `discover`) were called in this session. If not — inject warning into args (advisory block, not hard block — hard block breaks UX).
4. **session state tracking** — `tool.execute.after` hook: track which tools called per session. Maintains in-memory map `sessionID → Set<toolName>`.

## Non-goals

- UI navigation по memory bank (requires OpenCode TUI changes, не plugin).
- Interactive memory diff confirmation (requires OpenCode UI API).
- Hard block of writes (breaks UX — advisory warning only).
- optional graph export (separate v0.4 item).

## Constraints (из discovery)

- `Plugin` type: `(input: PluginInput, options?) => Promise<Hooks>`.
- PluginInput: `{ client, project, directory, worktree, experimental_workspace, serverUrl, $ }`.
- Hooks: `chat.message`, `tool.execute.before`, `tool.execute.after`, `event`, `experimental.chat.system.transform`.
- Plugin registered via `.opencode/plugins/*.js` — auto-discovered.
- v3 template `quality-runtime.js` — working reference for hook patterns.
- `$` is BunShell — can run `npm run memory -- context` via shell.
- Plugin runs in Bun runtime (not Node) — use Bun-compatible APIs.

## Testable acceptance criteria

1. `memory-guard.js` scaffolded into `.opencode/plugins/` by `initMemory` / `bootstrapMemory`.
2. Plugin exports `MemoryGuardPlugin` function returning Hooks object with `chat.message`, `tool.execute.before`, `tool.execute.after`.
3. `chat.message` hook: on first message (no prior tool calls in session), runs `npm run memory -- context` and injects context pack into message parts.
4. `tool.execute.before` hook: intercepts Write/Edit/ast_grep_replace — if no memory tool called in session → adds warning to args (not blocks).
5. `tool.execute.after` hook: records tool name in session state map.
6. Plugin handles errors gracefully — if memory CLI fails, context injection skipped (not crash session).
7. Existing 102 tests green (plugin is scaffold template, not tested via vitest — integration tested via OpenCode runtime).
8. LIMITATIONS §4.9 + v0.4 updated.