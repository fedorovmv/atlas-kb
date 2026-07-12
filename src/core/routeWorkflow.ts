import { ChangeSurface, WorkflowPolicy, RouteResult } from "../schemas/workflow.js";

export const DEFAULT_POLICY: WorkflowPolicy = {
  modes: {
    direct: {
      maxComponents: 1,
      maxChangedFiles: 8,
      allowedTypes: ["bugfix", "refactor", "test", "docs", "chore"],
      forbiddenRisks: [
        "security-boundary", "data-migration", "api-contract-change",
        "distributed-consistency", "new-architecture", "deployment-change",
        "backward-incompatible", "performance-critical", "high-scale-impact",
        "auth-change", "encryption-change", "payment-flow", "audit-trail",
        "compliance-boundary", "multi-tenant-change", "feature-flag-removal",
        "cache-invalidation-strategy", "session-management", "rate-limiting",
      ],
    },
    plan: {
      maxComponents: 2,
      forbiddenRisks: ["new-architecture", "distributed-consistency", "security-boundary"],
      fullTypes: ["architecture"],
    },
    full: {
      triggerRisks: [
        "new-architecture", "distributed-consistency", "security-boundary",
        "data-migration", "deployment-change", "backward-incompatible",
        "multi-service-coordination", "state-machine-change", "consensus-protocol",
        "cross-region-replication",
      ],
      triggerDecisionDimensions: [
        "scalability", "consistency-model", "failure-handling", "observability",
        "security-model", "data-retention", "multi-tenancy", "api-versioning",
        "deployment-strategy", "disaster-recovery", "compliance", "performance-sla",
      ],
    },
  },
};

export function routeWorkflow(surface: ChangeSurface, policy: WorkflowPolicy = DEFAULT_POLICY): RouteResult {
  const reasons: string[] = [];

  // Priority chain: DIRECT → PLAN → FULL (spec-compliant order)

  // 1. Check DIRECT eligibility first
  if (surface.components.length <= policy.modes.direct.maxComponents &&
      surface.changedFiles.length <= policy.modes.direct.maxChangedFiles) {
    const forbidden = surface.risks.filter((r) => policy.modes.direct.forbiddenRisks.includes(r));
    if (forbidden.length === 0 && !(surface.type === "refactor" && surface.behaviorChange)) {
      reasons.push("Bounded change, low risk");
      return { mode: "direct", reasons, type: surface.type, risks: surface.risks, behaviorChange: surface.behaviorChange };
    }
    if (forbidden.length > 0) reasons.push(`DIRECT forbidden risks: ${forbidden.join(", ")}`);
    if (surface.type === "refactor" && surface.behaviorChange) reasons.push("Refactor with behavior change requires PLAN");
  } else {
    if (surface.components.length > policy.modes.direct.maxComponents)
      reasons.push(`Components exceed DIRECT limit: ${surface.components.length} > ${policy.modes.direct.maxComponents}`);
    if (surface.changedFiles.length > policy.modes.direct.maxChangedFiles)
      reasons.push(`Files exceed DIRECT limit: ${surface.changedFiles.length} > ${policy.modes.direct.maxChangedFiles}`);
  }

  // 2. Check PLAN eligibility
  if (surface.components.length <= policy.modes.plan.maxComponents) {
    const planForbidden = surface.risks.filter((r) => policy.modes.plan.forbiddenRisks.includes(r));
    if (planForbidden.length === 0 && !policy.modes.plan.fullTypes.includes(surface.type)) {
      reasons.push("Multi-component coordinated change");
      return { mode: "plan", reasons, type: surface.type, risks: surface.risks, behaviorChange: surface.behaviorChange };
    }
    if (planForbidden.length > 0) reasons.push(`PLAN forbidden risks: ${planForbidden.join(", ")}`);
    if (policy.modes.plan.fullTypes.includes(surface.type)) reasons.push(`Type requires FULL: ${surface.type}`);
  } else {
    reasons.push(`Components exceed PLAN limit: ${surface.components.length} > ${policy.modes.plan.maxComponents}`);
  }

  // 3. FULL fallback
  const trigger = surface.risks.find((r) => policy.modes.full.triggerRisks.includes(r));
  if (trigger) reasons.push(`Trigger risk detected: ${trigger}`);
  else reasons.push("DIRECT and PLAN ineligible");
  return { mode: "full", reasons, type: surface.type, risks: surface.risks, behaviorChange: surface.behaviorChange };
}
