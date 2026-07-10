# Plan: OpenCode plugin lifecycle — memory guard

2 tasks. Task 1: plugin template. Task 2: scaffold integration + docs.

## Task 1: memory-guard.js plugin template

**Files:** `src/scaffold/templates.ts` (add plugin template string)

**Steps:**
1. Add `MEMORY_GUARD_PLUGIN_TEMPLATE` constant — full JS source for `.opencode/plugins/memory-guard.js`:
   - Export `MemoryGuardPlugin` async function.
   - Input: `{ $, directory, worktree }` from PluginInput.
   - Return Hooks object:
     ```js
     return {
       "tool.execute.after": async (input, output) => {
         // Track tool usage per session
         if (!sessionTools.has(input.sessionID)) sessionTools.set(input.sessionID, new Set());
         sessionTools.get(input.sessionID).add(input.tool);
       },
       "chat.message": async (input, output) => {
         // On first user message, auto-inject memory context
         const tools = sessionTools.get(input.sessionID) ?? new Set();
         if (tools.size > 0) return; // not first interaction
         try {
           const result = await $`npm run memory -- context ${input.message}`.quiet();
           const context = await result.text();
           if (context.trim()) {
             output.parts.push({ type: "text", text: `\n--- Auto-injected memory context ---\n${context}\n--- End memory context ---\n` });
           }
         } catch { /* graceful fail */ }
       },
       "tool.execute.before": async (input, output) => {
         // Intercept write tools — advisory warning if memory not read
         const writeTools = ["Write", "Edit", "ast_grep_replace", "write", "edit"];
         if (!writeTools.includes(input.tool)) return;
         const tools = sessionTools.get(input.sessionID) ?? new Set();
         const memoryTools = ["context", "related", "discover", "validate", "memory_context"];
         const hasReadMemory = [...tools].some(t => memoryTools.includes(t));
         if (!hasReadMemory) {
           // Advisory: append warning to args (don't block)
           // Can't modify args meaningfully for Write/Edit, but can log
           console.warn(`[memory-guard] Write tool "${input.tool}" called without prior memory context read. Consider running /memory-context first.`);
         }
       },
     };
     ```
2. Add session state map: `const sessionTools = new Map();` at module scope.

**No tests** (plugin runs in OpenCode runtime, not vitest). Verify template string is valid JS by checking syntax.

**Completion:** `npx vitest run` — 102 green (no test changes, template string only).

---

## Task 2: Scaffold integration + docs

**Files:** `src/scaffold/templates.ts` (add to scaffold file list), `docs/LIMITATIONS.md`

**Steps:**
1. Add `.opencode/plugins/memory-guard.js` to scaffold file list in templates.ts (alongside existing `.opencode/tools/memory.ts` etc.). Use `MEMORY_GUARD_PLUGIN_TEMPLATE` from Task 1.
2. Don't overwrite if exists (same pattern as other scaffold files — check existsSync).
3. Update LIMITATIONS §4.9:
   - Move "полноценный OpenCode plugin с собственным lifecycle" to Реализовано.
   - Move "автоматическое внедрение memory-context перед каждой coding-задачей" to Реализовано.
   - Keep "UI-навигация" and "интерактивное подтверждение memory diff" in Не реализовано.
4. Update v0.4 roadmap: mark plugin lifecycle + auto context injection as ✅.

**Completion:** `npx vitest run` green, diff shows template + docs.