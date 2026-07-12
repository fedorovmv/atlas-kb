import { z } from "zod";

export const BoilerplateMatchSchema = z.object({
  sectionName: z.string(),
  pattern: z.string(),
  position: z.object({ line: z.number(), column: z.number() }),
});
export type BoilerplateMatch = z.infer<typeof BoilerplateMatchSchema>;

export const ExtractedSentenceSchema = z.object({
  text: z.string(),
  score: z.number(),
  sourcePath: z.string(),
  category: z.string().optional(),
});
export type ExtractedSentence = z.infer<typeof ExtractedSentenceSchema>;

export const CardScopeSchema = z.object({
  includes: z.array(z.string()),
  excludes: z.array(z.string()),
  allowPairs: z.array(z.tuple([z.string(), z.string()])),
});
export type CardScope = z.infer<typeof CardScopeSchema>;

export const RepairResultSchema = z.object({
  cardId: z.string(),
  repaired: z.boolean(),
  filledSections: z.array(z.string()),
  quarantined: z.boolean(),
  reason: z.string().optional(),
});
export type RepairResult = z.infer<typeof RepairResultSchema>;
