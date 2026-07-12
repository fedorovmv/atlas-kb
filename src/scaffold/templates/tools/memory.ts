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
    return [err.stdout, err.stderr, err.message].filter(Boolean).join("\n");
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

export const discover = tool({
  description: "Discover project files and candidate modules.",
  args: {
    root: tool.schema.string().optional().describe("Repository root path"),
  },
  async execute(args) {
    return runMemory(["discover", ...(args.root ? ["--root", args.root] : [])]);
  },
});

export const bootstrap = tool({
  description: "Bootstrap memory bank from project discovery.",
  args: {
    root: tool.schema.string().optional().describe("Repository root path"),
    force: tool.schema.boolean().optional().describe("Overwrite existing memory cards"),
    dryRun: tool.schema.boolean().optional().describe("Preview without writing"),
  },
  async execute(args) {
    const flags: string[] = [];
    if (args.root) flags.push("--root", args.root);
    if (args.force) flags.push("--force");
    if (args.dryRun) flags.push("--dry-run");
    return runMemory(["bootstrap", ...flags]);
  },
});

export const updateCard = tool({
  description: "Safely update a memory card body or frontmatter fields by id. Use this instead of Write to avoid corrupting frontmatter.",
  args: {
    id: tool.schema.string().describe("Memory entity id to update"),
    body: tool.schema.string().optional().describe("New body content (replaces existing body). Read code first before writing."),
    setLastReviewed: tool.schema.string().optional().describe("Set last_reviewed date (YYYY-MM-DD)"),
    setEvidenceLevel: tool.schema.string().optional().describe("Set evidence_level field"),
    setSourceConfidence: tool.schema.string().optional().describe("Set source_confidence field"),
    setStatus: tool.schema.string().optional().describe("Set status field"),
    setReviewRequired: tool.schema.boolean().optional().describe("Set review_required field"),
  },
  async execute(args) {
    const setArgs: string[] = [];
    if (args.setLastReviewed) setArgs.push("--set", "last_reviewed=" + args.setLastReviewed);
    if (args.setEvidenceLevel) setArgs.push("--set", "evidence_level=" + JSON.stringify(args.setEvidenceLevel));
    if (args.setSourceConfidence) setArgs.push("--set", "source_confidence=" + JSON.stringify(args.setSourceConfidence));
    if (args.setStatus) setArgs.push("--set", "status=" + JSON.stringify(args.setStatus));
    if (args.setReviewRequired !== undefined) setArgs.push("--set", "review_required=" + args.setReviewRequired);
    const bodyArgs = args.body ? ["--body", args.body] : [];
    return runMemory(["update", args.id, ...bodyArgs, ...setArgs, "--json"]);
  },
});

export const triage = tool({
  description: "Run automatic source triage.",
  args: {
    root: tool.schema.string().optional().describe("Repository root path"),
  },
  async execute(args) {
    return runMemory(["triage", ...(args.root ? ["--root", args.root] : []), "--json"]);
  },
});
