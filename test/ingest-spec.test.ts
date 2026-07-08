import { describe, it, expect } from "vitest";
import { loadSynapseMini } from "./helpers.js";
import { discoverProject } from "../src/core/discoverProject.js";
import { classifySpecActuality, extractClaims, checkEvidence } from "../src/core/specClassification.js";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
