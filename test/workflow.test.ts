import { describe, expect, it } from "vitest";
import { analyzeChangeSurface } from "../src/core/changeSurface.js";
import { routeWorkflow } from "../src/core/routeWorkflow.js";
import { ChangeSurface } from "../src/schemas/workflow.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("analyzeChangeSurface", () => {
  it("no git repo → empty surface", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "workflow-test-"));

    const surface = await analyzeChangeSurface({ root: dir });

    expect(surface.changedFiles).toEqual([]);
    expect(surface.components).toEqual([]);
    expect(surface.risks).toEqual([]);

    await rm(dir, { recursive: true, force: true });
  });
});

describe("routeWorkflow", () => {
  function makeSurface(overrides: Partial<ChangeSurface> = {}): ChangeSurface {
    return {
      changedFiles: [],
      components: [],
      risks: [],
      type: "feature",
      behaviorChange: false,
      ...overrides,
    };
  }

  it("1 component, 5 files, bugfix → DIRECT", () => {
    const surface = makeSurface({
      changedFiles: ["src/a.js", "src/b.js", "src/c.js", "src/d.js", "src/e.js"],
      components: ["src"],
      type: "bugfix",
      behaviorChange: true,
      risks: [],
    });
    const result = routeWorkflow(surface);
    expect(result.mode).toBe("direct");
  });

  it("2 components → PLAN", () => {
    const surface = makeSurface({
      changedFiles: ["src/a.js", "lib/b.js"],
      components: ["src", "lib"],
      type: "feature",
      behaviorChange: true,
      risks: [],
    });
    const result = routeWorkflow(surface);
    expect(result.mode).toBe("plan");
  });

  it("security-boundary risk → not DIRECT (escalate)", () => {
    const surface = makeSurface({
      changedFiles: ["src/auth/module.js"],
      components: ["src"],
      type: "bugfix",
      risks: ["security-boundary"],
      behaviorChange: true,
    });
    const result = routeWorkflow(surface);
    expect(result.mode).not.toBe("direct");
  });

  it("new-architecture risk → FULL (PLAN forbidden)", () => {
    const surface = makeSurface({
      changedFiles: ["src/architecture/design.js"],
      components: ["src"],
      type: "feature",
      risks: ["new-architecture"],
      behaviorChange: true,
    });
    const result = routeWorkflow(surface);
    expect(result.mode).toBe("full");
  });

  it("9 files → escalate to PLAN", () => {
    const files = [];
    for (let i = 0; i < 9; i++) files.push(`src/file${i}.js`);
    const surface = makeSurface({
      changedFiles: files,
      components: ["src"],
      type: "feature",
      behaviorChange: true,
      risks: [],
    });
    const result = routeWorkflow(surface);
    expect(result.mode).toBe("plan");
  });

  it("refactor with behaviorChange=false → DIRECT eligible", () => {
    const surface = makeSurface({
      changedFiles: ["src/refactor/module.js"],
      components: ["src"],
      type: "refactor",
      behaviorChange: false,
      risks: [],
    });
    const result = routeWorkflow(surface);
    expect(result.mode).toBe("direct");
  });

  it("refactor with behaviorChange=true → PLAN", () => {
    const surface = makeSurface({
      changedFiles: ["src/refactor/module.js"],
      components: ["src"],
      type: "refactor",
      behaviorChange: true,
      risks: [],
    });
    const result = routeWorkflow(surface);
    expect(result.mode).toBe("plan");
  });

  it("3 components → FULL", () => {
    const surface = makeSurface({
      changedFiles: ["src/a.js", "lib/b.js", "pkg/c.js"],
      components: ["src", "lib", "pkg"],
      type: "feature",
      behaviorChange: true,
      risks: [],
    });
    const result = routeWorkflow(surface);
    expect(result.mode).toBe("full");
  });
});
