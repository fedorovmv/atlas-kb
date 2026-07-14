import { z } from "zod";

export const MODEL_ROLES = {
  orchestrator: "orchestrator",
  repositoryDiscovery: "atlas-extractor",
  architectureSynthesis: "atlas-analyst",
  implementation: "atlas-coder",
  semanticReview: "atlas-reviewer",
} as const;

export const ModelProfileSchema = z.record(z.string(), z.string());

export const ModelRoutingSchema = z.object({
  profiles: z.object({
    quality: ModelProfileSchema,
    balanced: ModelProfileSchema,
    economy: ModelProfileSchema,
  }),
  activeProfile: z.enum(["quality", "balanced", "economy"]).default("balanced"),
  routing: z.record(z.string(), z.string()),
});

export type ModelProfile = z.infer<typeof ModelProfileSchema>;
export type ModelRouting = z.infer<typeof ModelRoutingSchema>;
