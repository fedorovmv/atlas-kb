// Memory Guard Plugin — auto-inject memory context, track tool usage, advisory enforcement
// Auto-scaffolded by repo-memory-opencode-kit

const sessionTools = new Map();

export const MemoryGuardPlugin = async ({ $, directory }) => {
  const memoryTools = ["context", "related", "discover", "validate", "memory_context", "bootstrap"];
  const writeTools = ["Write", "Edit", "ast_grep_replace", "write", "edit", "bash"];

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
        const result = await `npm run memory -- context ${messageText.slice(0, 200)}`.quiet();
        const context = await result.text();
        if (context && context.trim().length > 0) {
          output.parts.push({
            type: "text",
            text: `\n--- Auto-injected memory context ---\n${context.slice(0, 4000)}\n--- End memory context ---\n`
          });
        }
      } catch (e) {
        // Graceful fail — don't crash session
        console.error("[memory-guard] Context injection failed:", e?.message ?? e);
      }
    },

    // Advisory: warn if write tool called without memory read
    "tool.execute.before": async (input, _output) => {
      if (!writeTools.includes(input.tool)) return;

      const tools = sessionTools.get(input.sessionID) ?? new Set();
      const hasReadMemory = [...tools].some(t => memoryTools.includes(t.toLowerCase()));

      if (!hasReadMemory) {
        console.warn(
          "[memory-guard] Write tool '" + input.tool + "' called without prior memory context. " +
          "Consider running /memory-context first to avoid missing product context."
        );
      }
    },
  };
};

export default MemoryGuardPlugin;
