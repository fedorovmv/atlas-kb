import type { MemoryCard } from "./types.js";
import type { FileRecord } from "../schemas/discovery.js";
import type { RuntimeTier } from "../schemas/frontmatter.js";

/**
 * Classify the runtime tier of a memory card based on its code refs and discovery data.
 *
 * Priority order (highest first):
 *   historical → mixed(demo+prod) → demo(demo+test, !prod) → demo → mixed(prod+test)
 *   → production → shared(shared/common path) → unknown
 */
export function classifyRuntimeTier(card: MemoryCard, _discovery: FileRecord[]): RuntimeTier {
  const codeRefs = card.meta.code_refs ?? [];
  const paths = codeRefs.map((ref) => ref.path);

  const hasDemo = paths.some(
    (p) => /(?:^|\/)(demo|example|examples|testdata)\//.test(p) || /(?:^|\/)(demo|example)\./.test(p),
  );
  const hasProduction = paths.some(
    (p) => !/(?:^|\/)(test|tests|spec|demo|example|examples|testdata|legacy|archive)\//.test(p),
  );
  const hasTest = paths.some((p) => /(?:^|\/)(test|tests)\//.test(p) || /\/_test\./.test(p) || /\.test\./.test(p));
  const hasShared = paths.some((p) => /(?:^|\/)(shared|common)\//.test(p));
  const isHistorical =
    card.meta.source_status === "historical-only" || card.meta.status === "historical";

  if (isHistorical) return "historical";
  if (hasDemo && hasProduction) return "mixed";
  if (hasDemo && hasTest && !hasProduction) return "demo";
  if (hasDemo) return "demo";
  if (hasProduction && hasTest) return "mixed";
  if (hasShared) return "shared";
  if (hasProduction) return "production";

  return "unknown";
}

/**
 * Check if a card's declared runtime_tier is consistent with its code refs.
 * Returns warning messages (empty array if no issues).
 */
export function checkRuntimeTierMismatch(card: MemoryCard): string[] {
  const { runtime_tier } = card.meta;
  if (!runtime_tier) return [];

  const warnings: string[] = [];

  if (runtime_tier === "production") {
    const codeRefs = card.meta.code_refs ?? [];
    const demoRefs = codeRefs.filter(
      (ref) => /(?:^|\/)(demo|example|examples|testdata)\//.test(ref.path) || /(?:^|\/)(demo|example)\./.test(ref.path),
    );
    if (demoRefs.length > 0) {
      warnings.push(
        `${card.relativePath}: runtime_tier=production but contains demo/example refs: ${demoRefs.map((r) => r.path).join(", ")}`,
      );
    }
  }

  return warnings;
}
