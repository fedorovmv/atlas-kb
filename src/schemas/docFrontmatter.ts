import { z } from "zod";

export const DocNodeTypeSchema = z.enum([
  "service", "reference", "decision", "runbook", "gotcha", "guide", "index",
]);
export type DocNodeType = z.infer<typeof DocNodeTypeSchema>;

export const DocStatusSchema = z.enum([
  "active", "draft", "deprecated", "archived",
]);
export type DocStatus = z.infer<typeof DocStatusSchema>;

export const DocFrontmatterSchema = z.object({
  node_type: DocNodeTypeSchema,
  title: z.string().min(1),
  service: z.string(),
  status: DocStatusSchema,
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags: z.array(z.string()),
  links: z.record(z.string(), z.string()),
}).passthrough();
export type DocFrontmatter = z.infer<typeof DocFrontmatterSchema>;
