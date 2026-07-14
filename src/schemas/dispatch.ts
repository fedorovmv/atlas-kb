import { z } from "zod";

export const SpecialistPhaseSchema = z.enum([
  "discovery-semantic", "code-evidence", "rationale-extraction", "quality-review",
]);
export type SpecialistPhase = z.infer<typeof SpecialistPhaseSchema>;

export const DispatchModeSchema = z.enum([
  "named-task", "skipped-no-applicable-work", "missing-attempt",
]);
export type DispatchMode = z.infer<typeof DispatchModeSchema>;

export const SPECIALIST_PHASE_AGENTS: Record<SpecialistPhase, string> = {
  "discovery-semantic": "atlas-extractor",
  "code-evidence": "atlas-coder",
  "rationale-extraction": "atlas-analyst",
  "quality-review": "atlas-reviewer",
};

export const GENERIC_AGENT_NAMES = new Set([
  "explore", "general", "plan", "task", "sonic",
  "librarian", "reviewer", "oracle", "designer",
]);

export const SpecialistAttemptSchema = z.object({
  attemptId: z.string(),
  phase: SpecialistPhaseSchema,
  expectedAgent: z.string(),
  requestedAgent: z.string(),
  actualAgent: z.string(),
  tool: z.string(),
  runtime: z.literal("opencode"),
  status: z.enum(["named-task", "skipped-no-applicable-work", "missing-attempt"]),
  session: z.string().optional(),
  toolCallId: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type SpecialistAttempt = z.infer<typeof SpecialistAttemptSchema>;
