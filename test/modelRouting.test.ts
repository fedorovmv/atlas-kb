import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import * as yaml from "js-yaml";
import { ModelRoutingSchema } from "../src/schemas/modelRouting.js";
import { loadModelRouting, switchProfile, getActiveProfile } from "../src/core/modelRouting.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "model-routing-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function writeModelRouting(config: any) {
  const configDir = path.join(tmpDir, ".ai/atlas/config");
  return writeFile(
    path.join(configDir, "model-routing.yaml"),
    yaml.dump(config, { lineWidth: -1 }),
    "utf8"
  );
}

const validConfig = {
  profiles: {
    quality: {
      orchestrator: "claude-opus-4",
      "atlas-extractor": "claude-opus-4",
      "atlas-analyst": "claude-opus-4",
      "atlas-coder": "claude-opus-4",
      "atlas-reviewer": "claude-opus-4",
    },
    balanced: {
      orchestrator: "claude-sonnet-4",
      "atlas-extractor": "claude-sonnet-4",
      "atlas-analyst": "claude-sonnet-4",
      "atlas-coder": "claude-sonnet-4",
      "atlas-reviewer": "claude-sonnet-4",
    },
    economy: {
      orchestrator: "claude-haiku-4",
      "atlas-extractor": "claude-haiku-4",
      "atlas-analyst": "claude-sonnet-4",
      "atlas-coder": "claude-sonnet-4",
      "atlas-reviewer": "claude-haiku-4",
    },
  },
  activeProfile: "balanced",
  routing: {
    discovery: "atlas-extractor",
    analysis: "atlas-analyst",
    implementation: "atlas-coder",
    review: "atlas-reviewer",
    orchestration: "orchestrator",
  },
};

describe("loadModelRouting", () => {
  it("parses model-routing.yaml with profiles", async () => {
    const configDir = path.join(tmpDir, ".ai/atlas/config");
    await mkdir(configDir, { recursive: true });
    await writeModelRouting(validConfig);

    const routing = await loadModelRouting(tmpDir);
    expect(routing).not.toBeNull();
    expect(routing!.activeProfile).toBe("balanced");
    expect(routing!.profiles.quality.orchestrator).toBe("claude-opus-4");
    expect(routing!.profiles.economy["atlas-analyst"]).toBe("claude-sonnet-4");
    expect(routing!.routing.discovery).toBe("atlas-extractor");
  });

  it("missing file returns null", async () => {
    const routing = await loadModelRouting(tmpDir);
    expect(routing).toBeNull();
  });
});

describe("switchProfile", () => {
  it("updates activeProfile in YAML", async () => {
    const configDir = path.join(tmpDir, ".ai/atlas/config");
    await mkdir(configDir, { recursive: true });
    await writeModelRouting(validConfig);

    await switchProfile({ root: tmpDir, profile: "quality" });

    const routing = await loadModelRouting(tmpDir);
    expect(routing).not.toBeNull();
    expect(routing!.activeProfile).toBe("quality");
  });

  it("preserves profiles and routing sections", async () => {
    const configDir = path.join(tmpDir, ".ai/atlas/config");
    await mkdir(configDir, { recursive: true });
    await writeModelRouting(validConfig);

    await switchProfile({ root: tmpDir, profile: "economy" });

    const routing = await loadModelRouting(tmpDir);
    expect(routing).not.toBeNull();
    expect(routing!.activeProfile).toBe("economy");
    expect(Object.keys(routing!.profiles)).toContain("quality");
    expect(Object.keys(routing!.profiles)).toContain("balanced");
    expect(Object.keys(routing!.profiles)).toContain("economy");
    expect(routing!.profiles.quality.orchestrator).toBe("claude-opus-4");
    expect(routing!.routing.discovery).toBe("atlas-extractor");
    expect(routing!.routing.orchestration).toBe("orchestrator");
  });

  it("corrupted YAML throws Zod parse error", async () => {
    const configDir = path.join(tmpDir, ".ai/atlas/config");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "model-routing.yaml"),
      "activeProfile: quality\nrouting:\n  discovery: atlas-extractor\n",
      "utf8"
    );

    await expect(switchProfile({ root: tmpDir, profile: "quality" })).rejects.toThrow();
  });
});

describe("getActiveProfile", () => {
  it("returns activeProfile from config", async () => {
    const configDir = path.join(tmpDir, ".ai/atlas/config");
    await mkdir(configDir, { recursive: true });
    const configWithQuality = { ...validConfig, activeProfile: "quality" };
    await writeModelRouting(configWithQuality);

    const profile = await getActiveProfile(tmpDir);
    expect(profile).toBe("quality");
  });

  it("missing config returns balanced default", async () => {
    const profile = await getActiveProfile(tmpDir);
    expect(profile).toBe("balanced");
  });
});

describe("ModelRoutingSchema", () => {
  it("valid config parses successfully", () => {
    const result = ModelRoutingSchema.parse(validConfig);
    expect(result.activeProfile).toBe("balanced");
    expect(result.profiles).toHaveProperty("quality");
    expect(result.profiles).toHaveProperty("balanced");
    expect(result.profiles).toHaveProperty("economy");
    expect(result.routing).toHaveProperty("discovery");
  });

  it("missing profiles throws parse error", () => {
    const invalidConfig = {
      activeProfile: "balanced",
      routing: { discovery: "atlas-extractor" },
    };
    expect(() => ModelRoutingSchema.parse(invalidConfig)).toThrow();
  });
});
