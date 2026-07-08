import { tool } from "@opencode-ai/plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runMemory(args: string[]) {
  try {
    const result = await execFileAsync("npm", ["run", "memory", "--", ...args], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 8,
    });
    return result.stdout || result.stderr;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return [err.stdout, err.stderr, err.message].filter(Boolean).join("
");
  }
}

export const context = tool({
  description: "Build a compact repository memory context pack for a task.",
  args: {
    query: tool.schema.string().describe("Task or question to build memory context for"),
    limit: tool.schema.number().optional().describe("Maximum number of primary memory cards"),
  },
  async execute(args) {
    return runMemory(["context", args.query, "--limit", String(args.limit ?? 8)]);
  },
});

export const validate = tool({
  description: "Validate .ai/memory frontmatter, policies and relations.",
  args: {},
  async execute() {
    return runMemory(["validate", "--json"]);
  },
});

export const related = tool({
  description: "Show memory entities related to a given memory id.",
  args: {
    id: tool.schema.string().describe("Memory entity id"),
  },
  async execute(args) {
    return runMemory(["related", args.id, "--json"]);
  },
});
