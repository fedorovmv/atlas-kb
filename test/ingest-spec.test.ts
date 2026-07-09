import { describe, it, expect } from "vitest";
import { loadSynapseMini, createTempProject } from "./helpers.js";
import { discoverProject } from "../src/core/discoverProject.js";
import { classifySpecActuality, extractClaims, checkEvidence } from "../src/core/specClassification.js";
import { ingestSpecCommand } from "../src/commands/ingestSpec.js";
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
