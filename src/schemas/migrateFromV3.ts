import { z } from "zod";

export const V3FrontmatterSchema = z
  .object({
    memory_card_type: z.string(),
    runtime_tier: z.enum(["production", "demo", "shared", "mixed", "historical", "unknown"]),
    source_status: z.enum(["current", "active-rationale", "partially-active", "superseded", "historical-only", "unknown"]),
    evidence_level: z.enum(["code", "test", "config", "manifest", "current-doc", "rationale-only", "mixed", "unknown"]),
    scope: z.string().optional(),
    owned_paths: z.array(z.string()).optional(),
    related_cards: z.array(z.string()).optional(),
    language: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough();

export type V3Frontmatter = z.infer<typeof V3FrontmatterSchema>;

export const ENTITY_TYPE_MAP: Record<string, string> = {
  module: "module",
  flow: "flow",
  decision: "decision",
  reference: "reference",
  architecture: "architecture",
  project: "project",
  routing: "task_routing",
  testing: "testing",
  ops: "ops",
  gotchas: "gotchas",
  index: "readme",
  "module-index": "readme",
  "flow-index": "readme",
  "decision-index": "readme",
};

export const STATUS_MAP: Record<string, string> = {
  current: "current",
  "active-rationale": "current",
  "partially-active": "needs_review",
  superseded: "deprecated",
  "historical-only": "historical",
  unknown: "needs_review",
};

export const AUTHORITY_MAP: Record<string, string> = {
  code: "source_of_truth",
  test: "source_of_truth",
  config: "reviewed_memory",
  manifest: "reviewed_memory",
  "current-doc": "reviewed_memory",
  "rationale-only": "historical_context",
  mixed: "reviewed_memory",
  unknown: "reference",
};

export const EVIDENCE_LEVEL_MAP: Record<string, string> = {
  code: "code_confirmed",
  test: "test_confirmed",
  config: "contract_confirmed",
  manifest: "contract_confirmed",
  "current-doc": "reviewed_doc",
  "rationale-only": "spec_only",
  mixed: "inferred",
  unknown: "unknown",
};

export const STABILITY_MAP: Record<string, string> = {
  current: "stable",
  "active-rationale": "stable",
  "partially-active": "evolving",
  superseded: "deprecated",
  "historical-only": "deprecated",
  unknown: "unknown",
};

export const SOURCE_CONFIDENCE_MAP: Record<string, string> = {
  code: "high",
  test: "high",
  config: "medium",
  manifest: "medium",
  "current-doc": "medium",
  "rationale-only": "low",
  mixed: "low",
  unknown: "unknown",
};

export const KNOWLEDGE_TYPES_MAP: Record<string, string[]> = {
  module: ["current_behavior", "code_evidence"],
  flow: ["current_behavior"],
  decision: ["design_rationale", "current_behavior"],
  reference: ["current_behavior"],
  architecture: ["current_behavior", "design_rationale"],
  project: ["current_behavior"],
  routing: ["current_behavior"],
  testing: ["current_behavior"],
  ops: ["current_behavior"],
  gotchas: ["current_behavior"],
  index: ["current_behavior"],
  "module-index": ["current_behavior"],
  "flow-index": ["current_behavior"],
  "decision-index": ["current_behavior"],
};

export const INDEX_TYPES = new Set(["index", "module-index", "flow-index", "decision-index"]);

export interface MigrationOptions {
  noAutoReview?: boolean;
  includeDocs?: boolean;
  skipCoverage?: boolean;
  preserveManifest?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

export interface MigrationResult {
  frontmatter: any;
  body: string;
  warnings: string[];
  errors: string[];
}

export interface MigrationReport {
  discovered: number;
  migrated: number;
  skipped: number;
  errors: number;
  warnings: number;
  byEntityType: Record<string, number>;
}

export interface V3Card {
  relativePath: string;
  frontmatter: V3Frontmatter;
  body: string;
  filename: string;
}
