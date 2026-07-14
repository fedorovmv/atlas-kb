import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { getCiTemplate } from "../src/scaffold/templates.js";

const TEMPLATES_DIR = path.resolve(__dirname, "../src/scaffold/templates");

describe("CI template file", () => {
  it("CI template exists at templates/.github/workflows/atlas-bank.yml", () => {
    expect(
      existsSync(path.join(TEMPLATES_DIR, ".github/workflows/atlas-bank.yml"))
    ).toBe(true);
  });

  it("is valid YAML", async () => {
    const content = await readFile(
      path.join(TEMPLATES_DIR, ".github/workflows/atlas-bank.yml"),
      "utf8"
    );
    expect(() => yaml.load(content)).not.toThrow();
  });

  it("contains atlas validate", async () => {
    const content = await readFile(
      path.join(TEMPLATES_DIR, ".github/workflows/atlas-bank.yml"),
      "utf8"
    );
    expect(content).toContain("atlas validate");
  });

  it("contains --require-source-coverage", async () => {
    const content = await readFile(
      path.join(TEMPLATES_DIR, ".github/workflows/atlas-bank.yml"),
      "utf8"
    );
    expect(content).toContain("--require-source-coverage");
  });

  it("runs on pull_request", async () => {
    const parsed = yaml.load(
      await readFile(
        path.join(TEMPLATES_DIR, ".github/workflows/atlas-bank.yml"),
        "utf8"
      )
    ) as any;
    expect(parsed.on.pull_request).toBeDefined();
  });

  it("uses ubuntu-latest", async () => {
    const parsed = yaml.load(
      await readFile(
        path.join(TEMPLATES_DIR, ".github/workflows/atlas-bank.yml"),
        "utf8"
      )
    ) as any;
    expect(parsed.jobs.validate["runs-on"]).toBe("ubuntu-latest");
  });

  it("uses Node 20", async () => {
    const parsed = yaml.load(
      await readFile(
        path.join(TEMPLATES_DIR, ".github/workflows/atlas-bank.yml"),
        "utf8"
      )
    ) as any;
    const steps = parsed.jobs.validate.steps;
    const setupNode = steps.find(
      (s: any) => s["uses"]?.includes("setup-node")
    );
    expect(setupNode).toBeDefined();
    expect(setupNode.with["node-version"]).toBe("20");
  });
});

describe("getCiTemplate", () => {
  it("returns correct path", () => {
    const template = getCiTemplate();
    expect(template.path).toBe(".github/workflows/atlas-bank.yml");
  });

  it("returns non-empty content", () => {
    const template = getCiTemplate();
    expect(template.content.length).toBeGreaterThan(0);
  });
});
