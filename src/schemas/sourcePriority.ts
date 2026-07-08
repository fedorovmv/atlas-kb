import { z } from "zod";

export const SourcePrioritySchema = z.object({
  priority: z.array(z.string().min(1)),
  rules: z.array(z.string().min(1)).optional().default([]),
});

export type SourcePriority = z.infer<typeof SourcePrioritySchema>;

export default SourcePriority;
