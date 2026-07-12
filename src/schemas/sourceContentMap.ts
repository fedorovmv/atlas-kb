import { z } from "zod";

export const SectionMapEntrySchema = z.object({
  heading: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  summary: z.string().optional(),
  keywordTopics: z.array(z.string()).default([]),
});
export type SectionMapEntry = z.infer<typeof SectionMapEntrySchema>;

export const SourceContentMapSchema = z.object({
  contentMapId: z.string(),
  path: z.string(),
  sha256: z.string(),
  title: z.string().optional(),
  moduleBoundary: z.string().optional(),
  classifiers: z.object({
    sourceType: z.string(),
    sourceStatus: z.string().optional(),
    memoryIntents: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
  }),
  topics: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
  referencedPaths: z.array(z.string()).default([]),
  targetCards: z.array(z.string()).default([]),
  sectionMap: z.array(SectionMapEntrySchema).default([]),
});
export type SourceContentMap = z.infer<typeof SourceContentMapSchema>;
