import { describe, it, expect } from "vitest";
import { loadSynapseMini, createTempProject } from "./helpers.js";
import { discoverProject } from "../src/core/discoverProject.js";
import { classifySpecActuality, extractClaims, checkEvidence } from "../src/core/specClassification.js";
import { ingestSpecCommand } from "../src/commands/ingestSpec.js";
import { findCardById, loadMemoryCards } from "../src/core/loadMemory.js";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import yamll from "js-yaml";

describe("spec classification and claim extraction", () => {
  it("extracts claims from 2027 spec", async () => {
    const root = loadSynapseMini();
    const specPath = path.join(root, "specs/2027-agent-tool-registry.md");
    const content = await readFile(specPath, "utf8");
    const claims = extractClaims(content, specPath);

    expect(claims.length).toBeGreaterThan(0);
    expect(claims[0].id).toMatch(/^claim-0\d+$/);
    expect(claims[0].source_path).toBe(specPath);
  });

  it("classifies legacy spec as historical_context", async () => {
    const root = loadSynapseMini();
    const discovery = await discoverProject({ root });
    const specPath = path.join(root, "specs/legacy/2025-agent-routing.md");
    const content = await readFile(specPath, "utf8");
    const claims = extractClaims(content, specPath);
    const evidence = checkEvidence(claims, discovery);
    const actual = classifySpecActuality(
      { path: specPath, content, mtime: undefined },
      discovery,
      [],
      evidence
    );
    expect(actual).toBe("historical_context");
  });

  it("classifies draft proposal as proposed_unconfirmed", () => {
    const spec = {
      path: "specs/draft.md",
      content: "# Draft\n## Background\n\nStatus: draft\n\n- must do X",
      mtime: undefined,
    };
    const discovery = { root: "", files: [], candidateModules: [] };
    const actual = classifySpecActuality(spec, discovery, [], []);
    expect(actual).toBe("proposed_unconfirmed");
  });

  it("checkEvidence finds code match for registry claim", () => {
    const claims = [
      {
        id: "claim-001",
        text: "Registry filters cards",
        type: "current_behavior" as const,
        evidence_required: true,
      },
    ];
    const discovery = {
      root: "",
      files: [
        {
          path: "internal/registry/access_filter.go",
          kind: "code" as const,
          basename: "access_filter.go",
          dirname: "internal/registry",
          sizeBytes: 100,
          signals: [],
          topics: [],
        },
      ],
      candidateModules: [],
    };
    const evidence = checkEvidence(claims, discovery);
    expect(evidence[0].status).toBe("confirmed_by_code");
  });

  it("checkEvidence returns not_found for unknown claim", async () => {
    const root = loadSynapseMini();
    const discovery = await discoverProject({ root });
    const claims = [
      {
        id: "claim-001",
        text: "Quantum computing",
        type: "current_behavior" as const,
        evidence_required: true,
      },
    ];
    const evidence = checkEvidence(claims, discovery);
    expect(evidence[0].status).toBe("not_found");
  });

  it("empty spec extracts no claims", () => {
    const claims = extractClaims("", "empty.md");
    expect(claims).toEqual([]);
  });
});

describe("ingestSpecCommand stores claims with evidence in card frontmatter", () => {
  async function extractFrontmatter(filePath: string): Promise<Record<string, any>> {
    const content = await readFile(filePath, "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    expect(match).not.toBeNull();
    const parsed = yamll.load(match![1]) as Record<string, any>;
    return parsed;
  }

  it("confirmed spec creates card with stored claims + evidence", async () => {
    const root = await createTempProject();
    const memoryRoot = path.join(root, ".ai/memory");

    // Write a spec with "accepted" keyword + a claim matching existing code
    const spec = `# Agent Registry Filter Spec

Status: accepted
Status: implemented

## Requirements

- The registry MUST filter cards by caller service identity
`;
    const specDir = path.join(root, "specs");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "agent-registry-filter.md"), spec, "utf8");

    await ingestSpecCommand("specs/*.md", {
      root,
      memoryRoot,
      force: true,
    });

    // Find the created card — it should land in proposals/ since it's "accepted + implemented"
    const proposalsDir = path.join(memoryRoot, "proposals");
    const fileNames = await readdir(proposalsDir);
    const cardFile = fileNames.find((f) => f.endsWith(".md") && f !== ".gitkeep");
    expect(cardFile).toBeDefined();

    const meta = await extractFrontmatter(path.join(proposalsDir, cardFile!));
    expect(meta.claims).toBeDefined();
    expect(Array.isArray(meta.claims)).toBe(true);
    expect(meta.claims.length).toBeGreaterThan(0);

    // At least one claim should have evidence with confirmed status
    const confirmedClaim = meta.claims.find((c: any) => c.evidence?.status === "confirmed_by_code");
    expect(confirmedClaim).toBeDefined();
    expect(confirmedClaim.last_checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("proposed spec creates card with claims where evidence is not_found", async () => {
    const root = await createTempProject();
    const memoryRoot = path.join(root, ".ai/memory");

    // Write a proposed spec with a claim that has NO matching code
    const spec = `# Quantum Entanglement Protocol

Status: draft

## Requirements

- The system MUST support quantum entanglement channels
`;
    const specDir = path.join(root, "specs");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "quantum-protocol.md"), spec, "utf8");

    await ingestSpecCommand("specs/*.md", {
      root,
      memoryRoot,
      force: true,
    });

    // Find the created card
    const proposalsDir = path.join(memoryRoot, "proposals");
    const fileNames = await readdir(proposalsDir);
    const cardFile = fileNames.find((f) => f.endsWith(".md") && f !== ".gitkeep");
    expect(cardFile).toBeDefined();

    const meta = await extractFrontmatter(path.join(proposalsDir, cardFile!));
    expect(meta.claims).toBeDefined();
    expect(Array.isArray(meta.claims)).toBe(true);
    expect(meta.claims.length).toBeGreaterThan(0);

    // Claim should have evidence status not_found since no code matches "quantum entanglement"
    const firstClaim = meta.claims[0];
    expect(firstClaim.evidence).toBeDefined();
    expect(firstClaim.evidence.status).toBe("not_found");
    expect(firstClaim.last_checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("ingestSpec cross-spec comparison", () => {
  async function extractFrontmatter(filePath: string): Promise<Record<string, any>> {
    const content = await readFile(filePath, "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    expect(match).not.toBeNull();
    const parsed = yamll.load(match![1]) as Record<string, any>;
    return parsed;
  }

  it("ingests two specs on same topic → supersedes/superseded_by populated", async () => {
    const root = await createTempProject();
    const memoryRoot = path.join(root, ".ai/memory");

    // Write a legacy deprecated spec about agent routing (2025)
    const legacySpec = `# Agent Routing Protocol

Status: deprecated

## Background

The 2025 agent routing protocol defines how agents find each other.
This spec is deprecated and will be replaced.
`;
    const legacyDir = path.join(root, "specs", "legacy");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(path.join(legacyDir, "2025-agent-routing.md"), legacySpec, "utf8");

    // Write a current accepted spec about agent registry (2027) that references 2025
    const currentSpec = `# Agent Registry

Status: accepted
Status: implemented

## Background

This spec replaces the 2025 agent routing protocol with a centralized registry.
The new registry supersedes the old routing mechanism and replaces 2025-agent-routing entirely.

## Requirements

- The registry MUST maintain a central directory of all agents
- The registry MUST provide lookup by service identity
`;
    const specDir = path.join(root, "specs");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "2027-agent-registry.md"), currentSpec, "utf8");

    await ingestSpecCommand("specs/**/*.md", {
      root,
      memoryRoot,
      force: true,
    });

    // Reload from disk to get updated frontmatter with relation fields
    const cards = await loadMemoryCards({ root, memoryRoot });
    const historicalCard = cards.find((c) => c.meta.entity_type === "historical");
    const proposalCard = cards.find((c) => c.meta.entity_type === "proposal");

    expect(historicalCard).toBeDefined();
    expect(proposalCard).toBeDefined();

    // Historical card should have superseded_by containing proposal card id
    const histMeta = await extractFrontmatter(historicalCard!.path);
    expect(histMeta.superseded_by).toBeDefined();
    expect(Array.isArray(histMeta.superseded_by)).toBe(true);
    expect(histMeta.superseded_by).toContain(proposalCard!.meta.id);

    // Proposal card should have supersedes containing historical card id
    const propMeta = await extractFrontmatter(proposalCard!.path);
    expect(propMeta.supersedes).toBeDefined();
    expect(Array.isArray(propMeta.supersedes)).toBe(true);
    expect(propMeta.supersedes).toContain(historicalCard!.meta.id);
  });

  it("ingests two current specs on same topic → conflicts_with + conflicts.md updated", async () => {
    const root = await createTempProject();
    const memoryRoot = path.join(root, ".ai/memory");

    // Write two specs both "accepted" about the same topic (load balancing)
    const specA = `# Load Balancer Spec Alpha

Status: accepted

## Requirements

- The load balancer MUST distribute requests across agents
- The load balancer MUST track agent health
`;
    const specB = `# Load Balancer Spec Beta

Status: accepted

## Requirements

- The load balancer MUST round-robin across available agents
- The load balancer MUST monitor agent health status
- The load balancer MUST failover on agent unavailability
`;
    const specDir = path.join(root, "specs");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "load-balancer-alpha.md"), specA, "utf8");
    await writeFile(path.join(specDir, "load-balancer-beta.md"), specB, "utf8");

    await ingestSpecCommand("specs/**/*.md", {
      root,
      memoryRoot,
      force: true,
    });

    // Reload cards
    const cards = await loadMemoryCards({ root, memoryRoot });
    const proposalCards = cards.filter((c) => c.meta.entity_type === "proposal");
    expect(proposalCards.length).toBeGreaterThanOrEqual(2);

    // Each card should have conflicts_with referencing the other
    for (const card of proposalCards) {
      const meta = await extractFrontmatter(card.path);
      const otherCards = proposalCards.filter((c) => c.meta.id !== card.meta.id);
      for (const other of otherCards) {
        expect(meta.conflicts_with).toBeDefined();
        expect(Array.isArray(meta.conflicts_with)).toBe(true);
        expect(meta.conflicts_with).toContain(other.meta.id);
      }
    }

    // Read reconciliation/conflicts.md and assert it contains conflict entries
    const conflictsPath = path.join(memoryRoot, "reconciliation", "conflicts.md");
    const conflictsContent = await readFile(conflictsPath, "utf8");
    expect(conflictsContent).toContain("Conflict:");
    expect(conflictsContent).toContain("conflicts_with");
  });

  it("idempotent: re-running ingestSpec does not duplicate relations", async () => {
    const root = await createTempProject();
    const memoryRoot = path.join(root, ".ai/memory");
    // Write a deprecated spec + accepted spec on same topic
    const specDir = path.join(root, "specs");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "legacy-2025-routing.md"),
      "# Agent Routing 2025\n\nStatus: deprecated\n\n## Background\nAgent routing replaced by 2027 registry.\n", "utf8");
    await writeFile(path.join(specDir, "2027-agent-registry.md"),
      "# Agent Registry 2027\n\nStatus: accepted\n\n## Requirements\nRegistry replaces 2025 routing.\n", "utf8");

    // First run
    await ingestSpecCommand("specs/*.md", { root, memoryRoot, force: true });
    const cards1 = await loadMemoryCards({ root, memoryRoot });
    const proposal1 = cards1.find(c => c.meta.entity_type === "proposal");
    const supersedes1 = (proposal1?.meta as any).supersedes ?? [];

    // Second run
    await ingestSpecCommand("specs/*.md", { root, memoryRoot, force: true });
    const cards2 = await loadMemoryCards({ root, memoryRoot });
    const proposal2 = cards2.find(c => c.meta.entity_type === "proposal");
    const supersedes2 = (proposal2?.meta as any).supersedes ?? [];

    // Same IDs, no duplicates
    expect(supersedes2).toEqual(supersedes1);
    expect(supersedes2.length).toBe(supersedes1.length);
  });

  it("ingests specs on different topics → no relations", async () => {
    const root = await createTempProject();
    const memoryRoot = path.join(root, ".ai/memory");

    // Write two specs about completely unrelated topics (zero word overlap)
    const specA = `# Xylophone Calibration Standard

Status: accepted

## Requirements

- The xylophone layer MUST support acoustic calibration
- The xylophone MUST track resonance frequency
`;
    const specB = `# Quasars gravitational lens specification

Status: draft

## Requirements

- The gravitational lens MUST support spectral distortion
- The gravitational lens MUST handle photon trajectory deviation
`;
    const specDir = path.join(root, "specs");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "xylophone-calibration.md"), specA, "utf8");
    await writeFile(path.join(specDir, "quasars-lens.md"), specB, "utf8");

    await ingestSpecCommand("specs/**/*.md", {
      root,
      memoryRoot,
      force: true,
      topicThreshold: 0.5,
    });

    // Reload cards
    const cards = await loadMemoryCards({ root, memoryRoot });
    const proposalCards = cards.filter((c) => c.meta.entity_type === "proposal");

    // No relations should exist (relation fields should be empty)
    for (const card of proposalCards) {
      const meta = await extractFrontmatter(card.path);
      // None of these should be set to non-empty arrays
      expect(meta.supersedes ?? []).toHaveLength(0);
      expect(meta.superseded_by ?? []).toHaveLength(0);
      expect(meta.conflicts_with ?? []).toHaveLength(0);
      expect(meta.related_specs ?? []).toHaveLength(0);
    }
  });
});
