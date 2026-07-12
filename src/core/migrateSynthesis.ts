import { z } from "zod";
import type { MemoryFrontmatter, EntityType, Status, KnowledgeType } from "../schemas/frontmatter.js";
import { AuthoritySchema, EvidenceLevelSchema, StabilitySchema, ConfidenceSchema } from "../schemas/frontmatter.js";
import type { V3Frontmatter, MigrationOptions } from "../schemas/migrateFromV3.js";
import {
  ENTITY_TYPE_MAP,
  STATUS_MAP,
  AUTHORITY_MAP,
  EVIDENCE_LEVEL_MAP,
  STABILITY_MAP,
  SOURCE_CONFIDENCE_MAP,
  KNOWLEDGE_TYPES_MAP,
  INDEX_TYPES,
} from "../schemas/migrateFromV3.js";

type Authority = z.infer<typeof AuthoritySchema>;
type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;
type Stability = z.infer<typeof StabilitySchema>;
type Confidence = z.infer<typeof ConfidenceSchema>;

const ID_REGEX = /^[a-z0-9][a-z0-9\-_.]*$/;

function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9\-_.]/g, "-").replace(/^[-_.]+/, "");
}

/** Generate a unique id from a slug, appending -1, -2, etc. on collision. */
export function synthesizeId(slug: string, usedIds: Set<string>): string {
  let normalized = normalizeSlug(slug);
  if (!ID_REGEX.test(normalized)) {
    normalized = "card-" + Date.now();
  }
  if (!usedIds.has(normalized)) {
    usedIds.add(normalized);
    return normalized;
  }
  let i = 1;
  while (usedIds.has(`${normalized}-${i}`)) {
    i++;
  }
  const finalId = `${normalized}-${i}`;
  usedIds.add(finalId);
  return finalId;
}

/** Derive title from v3 frontmatter or filename. */
export function synthesizeTitle(v3fm: V3Frontmatter, filename: string): string {
  if (v3fm.title && v3fm.title.trim().length > 0) {
    return v3fm.title;
  }
  const base = filename.replace(/\.md$/, "");
  const words = base.replace(/[-_]/g, " ").split(/\s+/);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const DEFAULT_USAGE_POLICY = {
  can_answer_current_behavior: true,
  can_generate_code_from: false,
  can_use_as_rationale: true,
  can_use_as_example: false,
  requires_code_check_before_change: true,
  requires_warning: false,
};

type UsagePolicy = typeof DEFAULT_USAGE_POLICY;

/** Synthesize usage policy based on target status. */
export function synthesizeUsagePolicy(status: string): UsagePolicy {
  if (status === "deprecated" || status === "historical") {
    return {
      ...DEFAULT_USAGE_POLICY,
      can_answer_current_behavior: false,
      requires_warning: true,
    };
  }
  return { ...DEFAULT_USAGE_POLICY };
}

/** Synthesize a ts-kb-flow MemoryFrontmatter from v3 frontmatter. */
export function synthesizeFrontmatter(
  v3fm: V3Frontmatter,
  options: { noAutoReview?: boolean },
  filename: string,
  usedIds: Set<string>
): MemoryFrontmatter {
  const slug = filename.replace(/\.md$/, "");
  const id = synthesizeId(slug, usedIds);
  const title = synthesizeTitle(v3fm, filename);
  const entity_type = (ENTITY_TYPE_MAP[v3fm.memory_card_type] ?? "reference") as EntityType;
  const status = (STATUS_MAP[v3fm.source_status] ?? "needs_review") as Status;
  const authority = (AUTHORITY_MAP[v3fm.evidence_level] ?? "reference") as Authority;
  const evidence_level = (EVIDENCE_LEVEL_MAP[v3fm.evidence_level] ?? "unknown") as EvidenceLevel;
  const stability = (STABILITY_MAP[v3fm.source_status] ?? "unknown") as Stability;
  const source_confidence = (SOURCE_CONFIDENCE_MAP[v3fm.evidence_level] ?? "unknown") as Confidence;
  const today = new Date().toISOString().slice(0, 10);

  // review_required logic
  let review_required = true;
  if (options.noAutoReview) {
    review_required = false;
  } else if (v3fm.source_status === "superseded" || v3fm.source_status === "historical-only") {
    review_required = false;
  }

  // knowledge_types logic
  let knowledge_types: KnowledgeType[] = [...(KNOWLEDGE_TYPES_MAP[v3fm.memory_card_type] ?? ["current_behavior"])] as KnowledgeType[];
  if (v3fm.source_status === "superseded") {
    knowledge_types = ["historical_context"];
  } else if (v3fm.source_status === "historical-only") {
    if (!knowledge_types.includes("historical_context")) {
      knowledge_types = ["historical_context", ...knowledge_types];
    }
  }

  const usage_policy = synthesizeUsagePolicy(status);

  return {
    entity_type,
    id,
    title,
    status,
    authority,
    evidence_level,
    stability,
    source_confidence,
    last_reviewed: today,
    review_required,
    knowledge_types,
    product_areas: [],
    aliases: [],
    related_modules: [],
    related_scenarios: [],
    related_decisions: [],
    related_specs: [],
    related_tests: [],
    conflicts_with: [],
    supersedes: [],
    superseded_by: [],
    affects_modules: [],
    affects_scenarios: [],
    affects_decisions: [],
    code_refs: [],
    test_refs: [],
    source_refs: [],
    usage_policy,
    claims: [],
    runtime_tier: v3fm.runtime_tier,
    source_status: v3fm.source_status,
  };
}

/** Decorate body with v3 metadata comments. */
export function decorateBody(body: string, v3fm: V3Frontmatter): string {
  let result = "";
  if (v3fm.language) {
    result += `<!-- v3: language=${v3fm.language} -->\n`;
  }
  if (INDEX_TYPES.has(v3fm.memory_card_type)) {
    result += `<!-- v3: memory_card_type=${v3fm.memory_card_type} -->\n`;
  }
  return result + body;
}
