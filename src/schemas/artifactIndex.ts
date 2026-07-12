import { z } from "zod";

export const ArtifactEntrySchema = z.object({
  path: z.string(),
  title: z.string(),
  kind: z.string(),
  signals: z.array(z.string()).default([]),
  contentHash: z.string(),
});
export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;

export const ArtifactIndexSchema = z.object({
  entries: z.array(ArtifactEntrySchema),
  generatedAt: z.string(),
});
export type ArtifactIndex = z.infer<typeof ArtifactIndexSchema>;

export const ArtifactHitSchema = z.object({
  entry: ArtifactEntrySchema,
  score: z.number(),
});
export type ArtifactHit = z.infer<typeof ArtifactHitSchema>;
