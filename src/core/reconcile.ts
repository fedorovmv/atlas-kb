import path from "node:path";
import { existsSync } from "node:fs";
import { loadMemoryCards } from "./loadMemory.js";
import { discoverProject } from "./discoverProject.js";
import { resolveRoot } from "./paths.js";
import type { RepoMemoryOptions } from "./types.js";

export type ReconcileReport = {
  staleRefs: string[];
  weakCurrentClaims: string[];
  realizableProposals: string[];
  orphanModules: string[];
};

export async function reconcileMemory(options: RepoMemoryOptions = {}): Promise<ReconcileReport> {
  const root = resolveRoot(options);
  const cards = await loadMemoryCards(options);
  const discovery = await discoverProject(options);
  const discoveredPaths = new Set(discovery.files.map((f) => f.path));

  const staleRefs: string[] = [];
  const weakCurrentClaims: string[] = [];
  const realizableProposals: string[] = [];
  const orphanModules: string[] = [];

  for (const card of cards) {
    for (const ref of [...card.meta.code_refs, ...card.meta.test_refs]) {
      if (ref.path.includes("*")) continue;
      const resolved = path.resolve(root, ref.path);
      if (!existsSync(resolved) && !discoveredPaths.has(ref.path)) {
        staleRefs.push(`${card.meta.id}: ${ref.path}`);
      }
    }
    if (card.meta.status === "current" && ["spec_only", "inferred", "unknown"].includes(card.meta.evidence_level)) {
      weakCurrentClaims.push(`${card.meta.id}: ${card.meta.evidence_level}`);
    }
    if (card.meta.entity_type === "proposal") {
      const codeMatch = discovery.files.some((f) => f.kind === "code" && card.body.toLowerCase().includes(f.basename.toLowerCase().replace(/\.\w+$/, "")));
      if (codeMatch) realizableProposals.push(card.meta.id);
    }
  }

  const moduleIds = new Set(cards.filter((c) => c.meta.entity_type === "module").map((c) => c.meta.id));
  for (const mod of discovery.candidateModules) {
    if (mod.confidence !== "low") {
      const modSuffix = mod.id.split("-").pop() ?? mod.id;
      const hasCard = [...moduleIds].some((id) => id.includes(modSuffix) || mod.id.includes(id.split("-").pop() ?? id));
      if (!hasCard) orphanModules.push(mod.id);
    }
  }

  return { staleRefs, weakCurrentClaims, realizableProposals, orphanModules };
}
