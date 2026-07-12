import { describe, expect, it } from "vitest";
import type { MemoryCard } from "../src/core/types.js";
import type { MemoryFrontmatter } from "../src/schemas/frontmatter.js";
import { detectSpecRelations } from "../src/core/specRelations.js";

const DEFAULT_USAGE_POLICY = {
  can_answer_current_behavior: false,
  can_generate_code_from: false,
  can_use_as_rationale: true,
  can_use_as_example: false,
  requires_code_check_before_change: false,
  requires_warning: false,
};

function defaultMeta(): MemoryFrontmatter {
  return {
    id: "spec-default",
    title: "Default",
    entity_type: "proposal",
    status: "proposed",
    authority: "proposed",
    evidence_level: "spec_only",
    stability: "evolving",
    source_confidence: "unknown",
    last_reviewed: "2025-01-01",
    review_required: false,
    knowledge_types: ["proposed_behavior"],
    product_areas: [],
    aliases: [],
    related_modules: [],
    related_scenarios: [],
    related_decisions: [],
    related_specs: [],
    related_tests: [],
    conflicts_with: [],
    supersedes: [],
    superseded_by: [],
    affects_modules: [],
    affects_scenarios: [],
    affects_decisions: [],
    code_refs: [],
    test_refs: [],
    source_refs: [],
    usage_policy: DEFAULT_USAGE_POLICY,
    claims: [],
  };
}

type MetaOverrides = {
  [K in keyof MemoryFrontmatter]?: K extends "usage_policy"
    ? Partial<NonNullable<MemoryFrontmatter[K]>>
    : MemoryFrontmatter[K];
} & { id: string; title: string };

/** Build a minimal MemoryCard fixture for tests. */
function makeCard(overrides: {
  meta?: MetaOverrides;
  body?: string;
  relativePath?: string;
  path?: string;
  raw?: string;
}): MemoryCard {
  const metaOverrides = overrides.meta ?? { id: "spec-test", title: "Test" };
  const meta = {
    ...defaultMeta(),
    ...metaOverrides,
    usage_policy: {
      ...DEFAULT_USAGE_POLICY,
      ...(metaOverrides.usage_policy ?? {}),
    },
  };
  const relativePath = overrides.relativePath ?? "specs/test.md";
  return {
    path: overrides.path ?? `/repo/${relativePath}`,
    relativePath,
    meta,
    body: overrides.body ?? "",
    raw: overrides.raw ?? `---\n...\n---\n\n${overrides.body ?? ""}`,
  };
}

describe("detectSpecRelations", () => {
  it("detects supersedes: deprecated historical -> accepted proposal on same topic", () => {
    const cardA = makeCard({
      relativePath: "historical/2025-agent-routing.md",
      meta: {
        id: "spec-2025-agent-routing",
        title: "2025 Agent Routing",
        entity_type: "historical",
        status: "deprecated",
        knowledge_types: ["historical_context"],
      },
      body: "## Agent Routing\n\nThis agent routing specification is deprecated, replaced by the 2027 agent tool registry.\n\nOld routing logic for agent-to-agent communication.",
    });

    const cardB = makeCard({
      relativePath: "proposals/2027-agent-tool-registry.md",
      meta: {
        id: "spec-2027-agent-tool-registry",
        title: "2027 Agent Tool Registry",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Agent Tool Registry\n\nThis registry replaces the 2025 agent routing specification.\n\nNew unified registry for agent tool discovery and routing.",
    });

    const relations = detectSpecRelations([cardA, cardB]);

    const supersedes = relations.find(
      (r) =>
        r.fromId === "spec-2027-agent-tool-registry" &&
        r.toId === "spec-2025-agent-routing" &&
        r.type === "supersedes"
    );
    expect(supersedes).toBeDefined();
  });

  it("detects conflicts_with: two current specs on same topic", () => {
    const cardA = makeCard({
      relativePath: "specs/agent-registry.md",
      meta: {
        id: "spec-agent-registry-alpha",
        title: "Agent Registry Alpha",
        entity_type: "proposal",
        status: "current",
        knowledge_types: ["current_behavior"],
      },
      body: "## Agent Registry\n\nThe agent registry provides centralized tool lookup.\n\nStatus: implemented",
    });

    const cardB = makeCard({
      relativePath: "specs/agent-registry-beta.md",
      meta: {
        id: "spec-agent-registry-beta",
        title: "Agent Registry Beta",
        entity_type: "proposal",
        status: "current",
        knowledge_types: ["current_behavior"],
      },
      body: "## Agent Registry\n\nAn alternative agent registry design with distributed discovery.\n\nStatus: implemented",
    });

    const relations = detectSpecRelations([cardA, cardB]);

    const aConflictsB = relations.find(
      (r) =>
        r.fromId === "spec-agent-registry-alpha" &&
        r.toId === "spec-agent-registry-beta" &&
        r.type === "conflicts_with"
    );
    const bConflictsA = relations.find(
      (r) =>
        r.fromId === "spec-agent-registry-beta" &&
        r.toId === "spec-agent-registry-alpha" &&
        r.type === "conflicts_with"
    );
    expect(aConflictsB).toBeDefined();
    expect(bConflictsA).toBeDefined();
  });

  it("detects related_specs via topic overlap", () => {
    const cardA = makeCard({
      relativePath: "proposals/agent-auth-flows.md",
      meta: {
        id: "spec-agent-auth",
        title: "Agent Auth",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Agent Authentication Flows\n\nDefines authentication and authorization flows for agent communication.\n\n## Token Exchange and OAuth\n\nIncludes token exchange and OAuth scopes for agent services.",
    });

    const cardB = makeCard({
      relativePath: "proposals/agent-token-exchange.md",
      meta: {
        id: "spec-agent-token-exchange",
        title: "Agent Token Exchange",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Agent Token Exchange\n\nSpecifies token exchange and authorization for agent communication.\n\n## Authentication and Flows\n\nCovers refresh tokens and agent auth flows between services.",
    });

    const relations = detectSpecRelations([cardA, cardB]);

    const relatedCount = relations.filter((r) => r.type === "related_specs").length;
    expect(relatedCount).toBe(2); // bidirectional

    const aRelatedB = relations.find(
      (r) =>
        r.fromId === "spec-agent-auth" &&
        r.toId === "spec-agent-token-exchange" &&
        r.type === "related_specs"
    );
    expect(aRelatedB).toBeDefined();
  });

  it("no relations for different topics", () => {
    const cardA = makeCard({
      relativePath: "proposals/agent-registry.md",
      meta: {
        id: "spec-agent-registry",
        title: "Agent Registry",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Agent Registry\n\nCentralized agent tool registration and lookup service.",
    });

    const cardB = makeCard({
      relativePath: "proposals/quantum-computing.md",
      meta: {
        id: "spec-quantum-computing",
        title: "Quantum Computing Interface",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Quantum Computing\n\nInterface for quantum computing algorithms and qubit management.",
    });

    const relations = detectSpecRelations([cardA, cardB]);
    expect(relations).toEqual([]);
  });

  it("explicit 'replaces' reference overrides topic threshold", () => {
    const cardA = makeCard({
      relativePath: "historical/2025-agent-routing.md",
      meta: {
        id: "spec-2025-agent-routing",
        title: "2025 Agent Routing",
        entity_type: "historical",
        status: "deprecated",
        knowledge_types: ["historical_context"],
      },
      body: "## Agent Routing\n\nThis specification is deprecated.",
    });

    const cardB = makeCard({
      relativePath: "proposals/quantum-gateway.md",
      meta: {
        id: "spec-quantum-gateway",
        title: "Quantum Gateway",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Quantum Gateway\n\nThis specification replaces 2025 for quantum computing workloads.",
    });

    // Topics are disjoint (routing vs quantum), but B explicitly "replaces 2025"
    const relations = detectSpecRelations([cardA, cardB]);

    const supersedes = relations.find(
      (r) =>
        r.fromId === "spec-quantum-gateway" &&
        r.toId === "spec-2025-agent-routing" &&
        r.type === "supersedes"
    );
    expect(supersedes).toBeDefined();
  });

  it("excludes non-spec cards from comparison", () => {
    const cardModule = makeCard({
      relativePath: "modules/registry.md",
      meta: {
        id: "mod-registry",
        title: "Registry Module",
        entity_type: "module",
        status: "current",
        knowledge_types: ["code_evidence"],
      },
      body: "The registry module handles tool registration.",
    });

    const cardA = makeCard({
      relativePath: "proposals/agent-auth.md",
      meta: {
        id: "spec-agent-auth",
        title: "Agent Auth",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Agent Auth\n\nAuthentication for agents.",
    });

    // Module card + one spec card — should produce no relations
    const relations = detectSpecRelations([cardModule, cardA]);
    expect(relations).toEqual([]);

    // Even two specs with different topics alongside module: no relations
    const cardBQuantum = makeCard({
      relativePath: "proposals/quantum.md",
      meta: {
        id: "spec-quantum",
        title: "Quantum",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Quantum\n\nQuantum computing specs.",
    });

    const allRelations = detectSpecRelations([cardModule, cardA, cardBQuantum]);
    expect(allRelations).toEqual([]);
  });

  it("does not emit related_specs when supersedes is detected for same pair", () => {
    const cardA = makeCard({
      relativePath: "historical/2025-agent-routing.md",
      meta: {
        id: "spec-2025-agent-routing",
        title: "2025 Agent Routing",
        entity_type: "historical",
        status: "deprecated",
        knowledge_types: ["historical_context"],
      },
      body: "## Agent Routing\n\nDeprecated agent routing spec, replaced by 2027.\n\nOld topics: agent routing communication.",
    });

    const cardB = makeCard({
      relativePath: "proposals/2027-agent-tool-registry.md",
      meta: {
        id: "spec-2027-agent-tool-registry",
        title: "2027 Agent Tool Registry",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Agent Tool Registry\n\nReplaces 2025 agent routing.\n\nTopics: agent routing registry communication.",
    });

    const relations = detectSpecRelations([cardA, cardB]);

    const supersedes = relations.filter((r) => r.type === "supersedes");
    const related = relations.filter((r) => r.type === "related_specs");
    expect(supersedes.length).toBe(1);
    expect(related.length).toBe(0);
  });

  it("respects custom topicThreshold option", () => {
    const cardA = makeCard({
      relativePath: "proposals/multi-tenancy.md",
      meta: {
        id: "spec-multi-tenancy",
        title: "Multi-Tenancy",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Multi-Tenancy\n\nDefines multi-tenant access control and isolation.",
    });

    const cardB = makeCard({
      relativePath: "proposals/access-control.md",
      meta: {
        id: "spec-access-control",
        title: "Access Control",
        entity_type: "proposal",
        status: "proposed",
        knowledge_types: ["proposed_behavior"],
      },
      body: "## Access Control\n\nAccess control policies for tenant isolation.",
    });

    // With high threshold, topics might not overlap enough
    const strictRelations = detectSpecRelations([cardA, cardB], { topicThreshold: 0.9 });
    // With low threshold, they should overlap
    const looseRelations = detectSpecRelations([cardA, cardB], { topicThreshold: 0.1 });

    // Loose threshold should find at least as many as strict
    expect(looseRelations.length).toBeGreaterThanOrEqual(strictRelations.length);
  });

  it("handles empty topics (Jaccard 0/0) without crash", () => {
    // Use paths that produce NO topics (all tokens < 3 chars or filtered)
    const cardA = makeCard({
      meta: { id: "spec-empty-a", title: "Empty A" },
      relativePath: "x/y.md", // "y" is 1 char → filtered by length >= 3
      body: "",
    });
    const cardB = makeCard({
      meta: { id: "spec-empty-b", title: "Empty B" },
      relativePath: "z/w.md",
      body: "",
    });

    // Should not crash on division by zero (union=0 → jaccard returns 0)
    const relations = detectSpecRelations([cardA, cardB]);
    expect(relations).toBeDefined();
    // Two proposal cards with no topic overlap → no relations
    expect(relations.length).toBe(0);
  });
});
