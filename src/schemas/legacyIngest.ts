import { z } from "zod";

export const LegacyClassSchema = z.enum([
  "openspec-requirement", "kb-service", "kb-reference",
  "kb-decision", "kb-runbook", "kb-gotcha",
  "draft-contradiction", "history-only", "duplicate", "unknown",
]);
export type LegacyClass = z.infer<typeof LegacyClassSchema>;

export const LegacyStateSchema = z.enum([
  "unclassified", "needs-evidence", "needs-human", "ready", "rejected",
]);
export type LegacyState = z.infer<typeof LegacyStateSchema>;

export const LegacyEvidenceSchema = z.object({
  path: z.string(),
  supports: z.string(),
  location: z.string().optional(),
});
export type LegacyEvidence = z.infer<typeof LegacyEvidenceSchema>;

export const LegacyCandidateSchema = z.object({
  id: z.string(),
  path: z.string(),
  classification: LegacyClassSchema,
  state: LegacyStateSchema,
  confidence: z.number(),
  rationale: z.string().optional(),
  targetPath: z.string().optional(),
  stagedPath: z.string().optional(),
  evidence: z.array(LegacyEvidenceSchema).default([]),
  subjectHash: z.string().optional(),
});
export type LegacyCandidate = z.infer<typeof LegacyCandidateSchema>;

export const LegacyBatchSchema = z.object({
  batchName: z.string(),
  candidates: z.array(LegacyCandidateSchema),
  createdAt: z.string(),
  stats: z.object({
    total: z.number(),
    byClass: z.record(z.string(), z.number()),
    byState: z.record(z.string(), z.number()),
  }).default({ total: 0, byClass: {}, byState: {} }),
});
export type LegacyBatch = z.infer<typeof LegacyBatchSchema>;

export const LegacyIngestResultSchema = z.object({
  batch: LegacyBatchSchema,
  candidates: z.array(LegacyCandidateSchema),
});
export type LegacyIngestResult = z.infer<typeof LegacyIngestResultSchema>;
