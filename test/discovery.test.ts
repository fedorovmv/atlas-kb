import path from "node:path";
import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { loadSynapseMini } from "./helpers.js";
import { discoverProject } from "../src/core/discoverProject.js";

describe("discoverProject", () => {
  it("returns 8 project files for synapse-mini (ignores .ai/memory and .opencode)", async () => {
    const root = loadSynapseMini();
    const report = await discoverProject({ root });

    expect(report.root).toBe(root);
    expect(report.files).toHaveLength(8);

    const fileNames = report.files.map((f) => f.basename);
    expect(fileNames).toContain("access_filter.go");
    expect(fileNames).toContain("access_filter_test.go");
    expect(fileNames).toContain("gateway.go");
    expect(fileNames).toContain("card.go");
    expect(fileNames).toContain("agent-registry.md");
    expect(fileNames).toContain("2027-agent-tool-registry.md");
    expect(fileNames).toContain("2025-agent-routing.md");
    expect(fileNames).toContain("main.go");
  });

  it("classifies files by kind correctly", async () => {
    const root = loadSynapseMini();
    const report = await discoverProject({ root });

    // Code files
    const accessFilter = report.files.find(
      (f) => f.path.includes("access_filter.go") && !f.path.includes("_test"),
    );
    expect(accessFilter?.kind).toBe("code");

    const gateway = report.files.find((f) => f.path.includes("gateway.go"));
    expect(gateway?.kind).toBe("code");

    const card = report.files.find((f) => f.path.includes("card.go"));
    expect(card?.kind).toBe("code");

    // Test file
    const accessFilterTest = report.files.find((f) => f.path.includes("access_filter_test.go"));
    expect(accessFilterTest?.kind).toBe("test");

    // Doc file
    const docFile = report.files.find((f) => f.path.includes("agent-registry.md"));
    expect(docFile?.kind).toBe("doc");

    // Legacy file (specs/legacy/)
    const legacyFile = report.files.find((f) => f.path.includes("2025-agent-routing.md"));
    expect(legacyFile?.kind).toBe("legacy");

    // Spec file
    const specFile = report.files.find((f) => f.path.includes("2027-agent-tool-registry.md"));
    expect(specFile?.kind).toBe("spec");

    // Demo file (examples/demo-agent/main.go)
    const demoFile = report.files.find((f) => f.path.includes("examples/demo-agent"));
    expect(demoFile?.kind).toBe("demo");
    expect(demoFile?.kind).not.toBe("code");
    expect(demoFile?.kind).not.toBe("example");
    expect(demoFile?.signals.filter((s) => s.includes("demo")).length).toBeGreaterThanOrEqual(1);
  });

  it("detects candidate module 'registry' with code + test files", async () => {
    const root = loadSynapseMini();
    const report = await discoverProject({ root });

    const registryModule = report.candidateModules.find(
      (m) => m.id === "registry" || m.id.includes("registry"),
    );
    expect(registryModule).toBeDefined();

    const module = registryModule!;
    expect(module.codeFiles.filter((p) => p.includes("access_filter.go")).length).toBeGreaterThanOrEqual(1);
    expect(module.testFiles.filter((p) => p.includes("access_filter_test.go")).length).toBeGreaterThanOrEqual(1);
  });

  it("excludes demo files from candidate module codeFiles", async () => {
    const root = loadSynapseMini();
    const report = await discoverProject({ root });

    for (const mod of report.candidateModules) {
      for (const cf of mod.codeFiles) {
        expect(cf).not.toMatch(/demo-agent/);
      }
    }

    // Also verify demo file exists in the report but as demo kind
    const demoFile = report.files.find((f) => f.kind === "demo");
    expect(demoFile).toBeDefined();
  });

  it("returns empty report for empty directory without crashing", async () => {
    const emptyDir = await mkdtemp(path.join(tmpdir(), "empty-test-"));
    const report = await discoverProject({ root: emptyDir });

    expect(report.root).toBe(emptyDir);
    expect(report.files).toEqual([]);
    expect(report.candidateModules).toEqual([]);
  });
});
