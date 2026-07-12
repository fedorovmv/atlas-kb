import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveRoot } from "./paths.js";
import { ChangeSurface } from "../schemas/workflow.js";

const execFileAsync = promisify(execFile);

export async function analyzeChangeSurface(options: {
  root?: string;
  baseRef?: string;
}): Promise<ChangeSurface> {
  const root = resolveRoot(options);
  const baseRef = options.baseRef ?? "HEAD~1";

  // Get changed files via git diff
  let changedFiles: string[] = [];
  try {
    const { stdout } = await execFileAsync("git", ["diff", "--name-only", baseRef], { cwd: root });
    changedFiles = stdout.trim().split("\n").filter(Boolean);
  } catch {
    // Not a git repo or no changes — empty surface
    changedFiles = [];
  }

  // Group by module/component (simplified: top-level directory)
  const components = new Set<string>();
  for (const file of changedFiles) {
    const parts = file.split("/");
    if (parts.length > 1) {
      components.add(parts[0]);
    }
  }

  // Heuristic risk detection
  // TODO(Phase 4): Replace heuristic risk detection with AST-based or config-driven rules.
  // Current string-includes approach is intentionally simple for Phase 3 MVP.
  const risks: string[] = [];
  for (const file of changedFiles) {
    if (file.includes("auth") || file.includes("security")) risks.push("security-boundary");
    if (file.includes("migration") || file.includes("schema")) risks.push("data-migration");
    if (file.includes("api") && file.includes("contract")) risks.push("api-contract-change");
    if (file.includes("distributed") || file.includes("consensus")) risks.push("distributed-consistency");
    if (file.includes("architecture")) risks.push("new-architecture");
  }

  // Heuristic type detection
  let type = "feature";
  const allText = changedFiles.join(" ").toLowerCase();
  if (allText.includes("fix") || allText.includes("bug")) type = "bugfix";
  if (allText.includes("refactor")) type = "refactor";
  if (allText.includes("test")) type = "test";
  if (allText.includes("doc")) type = "docs";
  if (allText.includes("chore")) type = "chore";

  // Behavior change heuristic: feature/bugfix = true, refactor/test/docs/chore = false
  const behaviorChange = ["feature", "bugfix"].includes(type);

  return {
    changedFiles,
    components: Array.from(components),
    risks: Array.from(new Set(risks)),
    type,
    behaviorChange,
  };
}
