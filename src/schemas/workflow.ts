import { z } from "zod";

export const WorkflowModeSchema = z.enum(["direct", "plan", "full"]);

export const ChangeSurfaceSchema = z.object({
  changedFiles: z.array(z.string()),
  components: z.array(z.string()),
  risks: z.array(z.string()),
  type: z.string(), // bugfix, feature, refactor, etc.
  behaviorChange: z.boolean(),
});

export const WorkflowPolicySchema = z.object({
  modes: z.object({
    direct: z.object({
      maxComponents: z.number().default(1),
      maxChangedFiles: z.number().default(8),
      allowedTypes: z.array(z.string()),
      forbiddenRisks: z.array(z.string()),
    }),
    plan: z.object({
      maxComponents: z.number().default(2),
      forbiddenRisks: z.array(z.string()),
      fullTypes: z.array(z.string()),
    }),
    full: z.object({
      triggerRisks: z.array(z.string()),
      triggerDecisionDimensions: z.array(z.string()),
    }),
  }),
});

export const RouteResultSchema = z.object({
  mode: WorkflowModeSchema,
  reasons: z.array(z.string()),
  type: z.string(),
  risks: z.array(z.string()),
  behaviorChange: z.boolean(),
});

export type WorkflowMode = z.infer<typeof WorkflowModeSchema>;
export type ChangeSurface = z.infer<typeof ChangeSurfaceSchema>;
export type WorkflowPolicy = z.infer<typeof WorkflowPolicySchema>;
export type RouteResult = z.infer<typeof RouteResultSchema>;
