import { z } from "zod";

export const ClaimTypeSchema = z.enum([
  "current_behavior",
  "proposed_behavior",
  "design_rationale",
  "historical_context",
  "open_question",
  "conflict",
]);

export const EvidenceStatusSchema = z.enum([
  "confirmed_by_code",
  "confirmed_by_test",
  "confirmed_by_contract",
  "supported_by_decision",
  "documented_only",
  "heuristic_code_match",
  "heuristic_test_match",
  "not_found",
  "conflicts_with_code",
  "not_checked",
]);

export const ClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  type: ClaimTypeSchema,
  module: z.string().optional(),
  scenario: z.string().optional(),
  decision: z.string().optional(),
  evidence_required: z.boolean().default(true),
  source_path: z.string().optional(),
});

export const EvidenceSchema = z.object({
  claim_id: z.string().min(1),
  status: EvidenceStatusSchema,
  confidence: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
  files: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

export type Claim = z.infer<typeof ClaimSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;

export const StoredClaimSchema = ClaimSchema.extend({
  evidence: EvidenceSchema.optional(),
  last_checked: z.string().optional(),
});

export type StoredClaim = z.infer<typeof StoredClaimSchema>;
