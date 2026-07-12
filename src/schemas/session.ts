import { z } from "zod";

export const SessionPhaseSchema = z.enum([
  "implementation",
  "correction",
  "review:spec",
  "review:plan",
  "review:code",
]);

export const ContinuationReasonSchema = z.enum([
  "interrupted-response",
  "unfinished-tool-sequence",
  "focused-test-failure",
  "immediate-local-correction",
]);

export const SessionLaneSchema = z.object({
  laneKey: z.string(),
  phase: SessionPhaseSchema,
  sessionId: z.string(),
  planTaskId: z.string().optional(),
  status: z.enum(["active", "completed", "failed"]),
  continuations: z.array(z.object({
    reason: ContinuationReasonSchema,
    sessionId: z.string(),
  })),
  filesChanged: z.array(z.string()),
  commandsRun: z.array(z.string()),
});

export const ExecutionSessionSchema = z.object({
  lanes: z.array(SessionLaneSchema),
});

export type SessionPhase = z.infer<typeof SessionPhaseSchema>;
export type ContinuationReason = z.infer<typeof ContinuationReasonSchema>;
export type SessionLane = z.infer<typeof SessionLaneSchema>;
export type ExecutionSession = z.infer<typeof ExecutionSessionSchema>;
