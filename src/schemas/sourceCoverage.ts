import { z } from "zod";

export const DispositionSchema = z.enum([
  "extracted", "rationale-only", "superseded",
  "historical-only", "rejected", "deferred", "unknown",
]);
export type Disposition = z.infer<typeof DispositionSchema>;

export const SourceKindSchema = z.enum([
  "git-tracked", "working-tree", "submodule-working-tree",
]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceCoverageEntrySchema = z.object({
  path: z.string(),
  sha256: z.string().optional(),
  moduleBoundary: z.string().optional(),
  sourceKind: SourceKindSchema.default("git-tracked"),
  docState: z.string().optional(),
  title: z.string().optional(),
  disposition: DispositionSchema,
  reason: z.string().optional(),
  targetCards: z.array(z.string()).default([]),
});
export type SourceCoverageEntry = z.infer<typeof SourceCoverageEntrySchema>;

export const SourceCoverageSchema = z.object({
  entries: z.array(SourceCoverageEntrySchema),
  counts: z.record(z.string(), z.number()).default({}),
});
export type SourceCoverage = z.infer<typeof SourceCoverageSchema>;
