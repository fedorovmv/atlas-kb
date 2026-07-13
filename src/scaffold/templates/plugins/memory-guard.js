// Memory Guard Plugin — auto-inject memory context, track tool usage, advisory enforcement
// Auto-scaffolded by repo-memory-opencode-kit
//
// Advisory enforcement: пишет warnings в лог-файл, НЕ в stdout/stderr,
// чтобы не ломать TUI OpenCode.

import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const LOG_FILE = join(tmpdir(), "memory-guard.log");

function logAdvisory(msg) {
  try {
    const ts = new Date().toISOString();
    appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`, "utf8");
  } catch {
    // silent fail — advisory logging must never break the session
  }
}

const sessionTools = new Map();

export const MemoryGuardPlugin = async ({ $, directory }) => {
  const memoryTools = ["context", "related", "discover", "validate", "memory_context", "bootstrap"];
  // Только реальные write-инструменты. bash НЕ включаем — это general execution
  // (git, npm, запуск memory CLI), false positive на каждый shell-вызов.
  const writeTools = ["Write", "Edit", "write", "edit", "ast_grep_replace"];

  return {
    // Track tool usage per session
    "tool.execute.after": async (input, _output) => {
      if (!sessionTools.has(input.sessionID)) {
        sessionTools.set(input.sessionID, new Set());
      }
      sessionTools.get(input.sessionID).add(input.tool);
    },

    // Auto-inject memory context on first user message
    "chat.message": async (input, output) => {
      const tools = sessionTools.get(input.sessionID) ?? new Set();
      if (tools.size > 0) return; // not first interaction — skip

      try {
        // Try to extract query from the message
        const messageText = typeof input.message === 'string' ? input.message :
          (input.message?.text ?? input.message?.content ?? '');
        if (!messageText || messageText.length < 5) return;

        // Run memory context CLI
        const result = await `.ai/memory-tool/bin/memory context ${messageText.slice(0, 200)}`.quiet();
        const context = await result.text();
        if (context && context.trim().length > 0) {
          output.parts.push({
            type: "text",
            text: `\n--- Auto-injected memory context ---\n${context.slice(0, 4000)}\n--- End memory context ---\n`
          });
        }
      } catch (e) {
        // Graceful fail — log to file, don't crash session, don't pollute TUI
        logAdvisory(`Context injection failed: ${e?.message ?? e}`);
      }
    },

    // Advisory: warn if write tool called without memory read.
    // Пишет в лог-файл, НЕ в stdout/stderr — чтобы не ломать TUI OpenCode.
    "tool.execute.before": async (input, _output) => {
      if (!writeTools.includes(input.tool)) return;

      const tools = sessionTools.get(input.sessionID) ?? new Set();
      const hasReadMemory = [...tools].some(t => memoryTools.includes(t.toLowerCase()));

      if (!hasReadMemory) {
        logAdvisory(
          "Write tool '" + input.tool + "' called without prior memory context. " +
          "Consider running /memory-context first to avoid missing product context."
        );
      }
    },
  };
};

export default MemoryGuardPlugin;
