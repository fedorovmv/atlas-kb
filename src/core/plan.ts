import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { discoverProject } from "./discoverProject.js";
import { classifyRuntimeTier } from "./runtimeTier.js";
import { resolveRoot, resolveMemoryRoot } from "./paths.js";
import type { MemoryCard } from "./types.js";
import type { FileRecord } from "../schemas/discovery.js";

export interface PlanResult {
  planPath: string;
  requiredCards: string[];
  candidateModuleCards: { id: string; runtimeTier: string }[];
  candidateArchitectureCards: { id: string }[];
}

export async function generatePlan(options?: {
  root?: string;
  buildDir?: string;
  scaffoldModules?: boolean;
}): Promise<PlanResult> {
  const root = resolveRoot(options);
  const memoryRoot = resolveMemoryRoot(options);
  const report = await discoverProject({ root });

  const requiredCards = [
    "MEMORY.md", "PROJECT.md", "MODULES.md", "ARCHITECTURE.md",
    "TASK_ROUTING.md", "FLOWS.md", "TESTING.md", "OPS.md",
    "GOTCHAS.md", "DECISIONS.md",
  ];

  const candidateModuleCards = report.candidateModules.map((mod) => {
    const fakeCard: MemoryCard = {
      path: "", relativePath: "",
      meta: {
        entity_type: "module", id: mod.id, title: mod.title,
        status: "current", authority: "reviewed_memory", evidence_level: "code_confirmed",
        stability: "stable", source_confidence: "high", last_reviewed: new Date().toISOString().slice(0, 10),
        review_required: false, knowledge_types: ["current_behavior"],
        code_refs: mod.codeFiles.map((p) => ({ path: p })),
        test_refs: mod.testFiles.map((p) => ({ path: p })),
        usage_policy: { can_answer_current_behavior: true, can_generate_code_from: true, can_use_as_rationale: true, requires_code_check_before_change: true },
      } as any,
      body: "", raw: "",
    };
    const tier = classifyRuntimeTier(fakeCard, report.files as FileRecord[]);
    return { id: mod.id, runtimeTier: tier };
  });

  const candidateArchitectureCards = report.candidateModules.map((mod) => ({ id: `architecture-${mod.id}` }));

  // Build card-plan.md
  const planLines = [
    "# Card Plan",
    "",
    "## Required top-level cards",
    ...requiredCards.map((c) => `- [ ] ${c}`),
    "",
    "## Candidate module cards",
    ...candidateModuleCards.map((m) => `- [ ] modules/${m.id}.md (runtime_tier: ${m.runtimeTier})`),
    "",
    "## Candidate architecture cards",
    ...candidateArchitectureCards.map((a) => `- [ ] architecture/${a.id}.md`),
    "",
  ];
  const planContent = planLines.join("\n");

  const buildDir = options?.buildDir ?? path.join(memoryRoot, "..", "memory-build", "latest");
  const planPath = path.join(buildDir, "card-plan.md");
  if (!existsSync(buildDir)) {
    await mkdir(buildDir, { recursive: true });
  }
  await writeFile(planPath, planContent, "utf8");

  // Scaffold stubs if requested
  if (options?.scaffoldModules) {
    for (const mod of candidateModuleCards) {
      const modulePath = path.join(memoryRoot, "modules", `${mod.id}.md`);
      if (!existsSync(modulePath)) {
        const today = new Date().toISOString().slice(0, 10);
        const stub = `---
entity_type: module
id: ${mod.id}
title: ${mod.id}
status: needs_review
authority: reviewed_memory
evidence_level: unknown
stability: evolving
source_confidence: low
last_reviewed: "${today}"
review_required: true
knowledge_types:
  - current_behavior
runtime_tier: ${mod.runtimeTier}
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# ${mod.id}

## Responsibilities
Needs review.
`;
        await mkdir(path.dirname(modulePath), { recursive: true });
        await writeFile(modulePath, stub, "utf8");
      }
    }
  }

  return { planPath, requiredCards, candidateModuleCards, candidateArchitectureCards };
}
