import { z } from "zod";
import { StoredClaimSchema } from "./claim.js";

export const EntityTypeSchema = z.enum([
  // существующие (11)
  "module",
  "scenario",
  "decision",
  "proposal",
  "historical",
  "conflict",
  "open_question",
  "architecture",
  "product_map",
  "ontology",
  "readme",
  // новые из v3 (9)
  "flow",
  "ops",
  "gotchas",
  "task_routing",
  "testing",
  "reference",
  "project",
  "routing",
  "index",
]);

export const StatusSchema = z.enum([
  "current",
  "proposed",
  "historical",
  "deprecated",
  "needs_review",
  "conflict",
]);

export const AuthoritySchema = z.enum([
  "source_of_truth",
  "reviewed_memory",
  "reference",
  "proposed",
  "historical_context",
  "example_only",
]);

export const EvidenceLevelSchema = z.enum([
  "code_confirmed",
  "test_confirmed",
  "contract_confirmed",
  "reviewed_doc",
  "heuristic_match",
  "spec_only",
  "inferred",
  "unknown",
]);

export const StabilitySchema = z.enum([
  "stable",
  "evolving",
  "experimental",
  "deprecated",
  "unknown",
]);

export const ConfidenceSchema = z.enum(["high", "medium", "low", "unknown"]);

export const RuntimeTierSchema = z.enum([
  "production",
  "demo",
  "shared",
  "mixed",
  "historical",
  "unknown",
]);
export type RuntimeTier = z.infer<typeof RuntimeTierSchema>;

export const SourceStatusSchema = z.enum([
  "current",
  "active-rationale",
  "partially-active",
  "superseded",
  "historical-only",
  "unknown",
]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const KnowledgeTypeSchema = z.enum([
  "current_behavior",
  "proposed_behavior",
  "design_rationale",
  "historical_context",
  "code_evidence",
  "open_question",
  "conflict",
]);

export const RefSchema = z.object({
  path: z.string().min(1),
  kind: z.string().optional(),
  role: z.string().optional(),
});

export const UsagePolicySchema = z.object({
  can_answer_current_behavior: z.boolean(),
  can_generate_code_from: z.boolean(),
  can_use_as_rationale: z.boolean(),
  can_use_as_example: z.boolean().optional().default(false),
  requires_code_check_before_change: z.boolean(),
  requires_warning: z.boolean().optional().default(false),
});

export const MemoryFrontmatterSchema = z.object({
  entity_type: EntityTypeSchema,
  id: z.string().min(1).regex(/^[a-z0-9][a-z0-9\-_.]*$/, "id must be stable kebab/dot/underscore case"),
  title: z.string().min(1),

  status: StatusSchema,
  authority: AuthoritySchema,
  evidence_level: EvidenceLevelSchema,
  stability: StabilitySchema,
  source_confidence: ConfidenceSchema,
  last_reviewed: z.preprocess((value) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value;
  }, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "last_reviewed must be YYYY-MM-DD")),
  review_required: z.boolean(),

  knowledge_types: z.array(KnowledgeTypeSchema).min(1),
  product_areas: z.array(z.string()).optional().default([]),
  aliases: z.array(z.string()).optional().default([]),

  related_modules: z.array(z.string()).optional().default([]),
  related_scenarios: z.array(z.string()).optional().default([]),
  related_decisions: z.array(z.string()).optional().default([]),
  related_specs: z.array(z.string()).optional().default([]),
  related_tests: z.array(z.string()).optional().default([]),
  conflicts_with: z.array(z.string()).optional().default([]),
  supersedes: z.array(z.string()).optional().default([]),
  superseded_by: z.array(z.string()).optional().default([]),

  affects_modules: z.array(z.string()).optional().default([]),
  affects_scenarios: z.array(z.string()).optional().default([]),
  affects_decisions: z.array(z.string()).optional().default([]),

  code_refs: z.array(RefSchema).optional().default([]),
  test_refs: z.array(RefSchema).optional().default([]),
  source_refs: z.array(RefSchema).optional().default([]),

  usage_policy: UsagePolicySchema,

  claims: z.array(StoredClaimSchema).optional().default([]),

  runtime_tier: RuntimeTierSchema.optional(),
  source_status: SourceStatusSchema.optional(),
}).passthrough();

export type MemoryFrontmatter = z.infer<typeof MemoryFrontmatterSchema>;
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type Status = z.infer<typeof StatusSchema>;
