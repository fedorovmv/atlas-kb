import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  discoverV3Cards,
  migrateCard,
  runMigration,
  migrateSourceCoverage,
  migrateSourceManifest,
  atomicWrite,
  createStagingDir,
  ensureTargetSubdirs,
} from "../src/core/migrateFromV3.js";
import { MemoryFrontmatterSchema } from "../src/schemas/frontmatter.js";

async function createV3Fixture(baseDir: string): Promise<void> {
  const memoryDir = path.join(baseDir, "knowledge", "memory");
  const subdirs = ["modules", "flows", "decisions", "architecture", "reference"];
  for (const sub of subdirs) {
    await mkdir(path.join(memoryDir, sub), { recursive: true });
  }

  await writeFile(
    path.join(memoryDir, "modules", "test-module.md"),
    `---
memory_card_type: module
runtime_tier: production
source_status: current
evidence_level: code
title: Test Module
---
This is a test module card body.
`
  );

  await writeFile(
    path.join(memoryDir, "flows", "test-flow.md"),
    `---
memory_card_type: flow
runtime_tier: production
source_status: current
evidence_level: current-doc
---
This is a test flow card body.
`
  );

  await writeFile(
    path.join(memoryDir, "decisions", "test-decision.md"),
    `---
memory_card_type: decision
runtime_tier: production
source_status: current
evidence_level: rationale-only
title: Test Decision
related_cards:
  - knowledge/memory/modules/test-module.md
  - knowledge/memory/flows/test-flow.md
---
This is a test decision card body.
`
  );

  await writeFile(
    path.join(memoryDir, "architecture", "test-arch.md"),
    `---
memory_card_type: architecture
runtime_tier: production
source_status: current
evidence_level: code
owned_paths:
  - src/core/paths.ts
  - src/core/utils.ts
---
This is a test architecture card body.
`
  );

  await writeFile(
    path.join(memoryDir, "reference", "test-ref.md"),
    `---
memory_card_type: reference
runtime_tier: production
source_status: current
evidence_level: current-doc
scope: auth-system
---
This is a test reference card body.
`
  );

  await writeFile(
    path.join(memoryDir, "MEMORY.md"),
    `---
memory_card_type: index
runtime_tier: unknown
source_status: unknown
evidence_level: unknown
---
Memory bank index.
`
  );

  await writeFile(
    path.join(memoryDir, "broken.md"),
    `---
this: is: broken
memory_card_type
---
Broken card body.
`
  );

  await writeFile(
    path.join(memoryDir, "source-coverage.json"),
    JSON.stringify({
      entries: [
        {
          path: "docs/x.md",
          disposition: "extracted",
          targetCards: ["knowledge/memory/modules/test-module.md"],
        },
      ],
      counts: {},
    })
  );

  await writeFile(
    path.join(memoryDir, "source-manifest.json"),
    JSON.stringify({ version: 3, items: [] })
  );

  await writeFile(
    path.join(memoryDir, "index.json"),
    JSON.stringify({ cards: [] })
  );

  await writeFile(
    path.join(memoryDir, "memory-contract.json"),
    JSON.stringify({ version: 1 })
  );
}

async function tmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "migrate-v3-test-"));
}

async function getAllFiles(baseDir: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        result.push(path.relative(baseDir, fullPath));
      }
    }
  }
  await walk(baseDir);
  return result;
}

describe("discoverV3Cards", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await tmpDir();
    await createV3Fixture(baseDir);
  });

  it("finds all .md files in knowledge/memory/ subdirs", async () => {
    const cards = await discoverV3Cards(baseDir);
    expect(cards.length).toBeGreaterThan(0);
    const filenames = cards.map((c) => c.filename);
    expect(filenames).toContain("test-module.md");
    expect(filenames).toContain("test-flow.md");
    expect(filenames).toContain("test-decision.md");
    expect(filenames).toContain("test-arch.md");
    expect(filenames).toContain("test-ref.md");
    expect(filenames).toContain("MEMORY.md");
    expect(filenames).not.toContain("broken.md");
  });

  it("skips non-.md files", async () => {
    const cards = await discoverV3Cards(baseDir);
    const relativePaths = cards.map((c) => c.relativePath);
    expect(relativePaths).not.toContain(expect.stringContaining(".json"));
  });
});

describe("migrateCard", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await tmpDir();
    await createV3Fixture(baseDir);
  });

  it("produces valid MemoryFrontmatter and decorated body", async () => {
    const cards = await discoverV3Cards(baseDir);
    const testModule = cards.find((c) => c.filename === "test-module.md");
    expect(testModule).toBeDefined();

    const usedIds = new Set<string>();
    const result = migrateCard(testModule!, { noAutoReview: false }, usedIds);

    const parseResult = MemoryFrontmatterSchema.safeParse(result.frontmatter);
    expect(parseResult.success).toBe(true);

    expect(result.frontmatter.entity_type).toBe("module");
    expect(result.frontmatter.id).toBeTruthy();
    expect(result.frontmatter.title).toBe("Test Module");
    expect(usedIds.has(result.frontmatter.id)).toBe(true);

    expect(result.body).toContain("---");
    expect(result.body).toContain("Test Module");
  });

  it("with unknown type -> warning, defaults to reference", async () => {
    const v3Card = {
      relativePath: "custom/unknown.md",
      frontmatter: {
        memory_card_type: "completely_unknown_type",
        runtime_tier: "unknown" as const,
        source_status: "unknown" as const,
        evidence_level: "unknown" as const,
      },
      body: "Custom body.",
      filename: "unknown.md",
    };

    const usedIds = new Set<string>();
    const result = migrateCard(v3Card, {}, usedIds);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Unknown memory_card_type");

    const parseResult = MemoryFrontmatterSchema.safeParse(result.frontmatter);
    expect(parseResult.success).toBe(true);
    expect(result.frontmatter.entity_type).toBe("reference");
  });
});

describe("migrateSourceCoverage", () => {
  let baseDir: string;
  let targetDir: string;

  beforeEach(async () => {
    baseDir = await tmpDir();
    targetDir = await tmpDir();
    await createV3Fixture(baseDir);
  });

  it("copies and transforms source-coverage.json", async () => {
    const ok = await migrateSourceCoverage(baseDir, targetDir);
    expect(ok).toBe(true);

    const targetPath = path.join(targetDir, "source-coverage.json");
    expect(existsSync(targetPath)).toBe(true);

    const content = JSON.parse(await readFile(targetPath, "utf8"));
    const entry = content.entries[0];
    expect(entry.targetCards).not.toContain("knowledge/memory/modules/test-module.md");
    expect(entry.targetCards).toContain("test-module");
  });
});

describe("migrateSourceManifest", () => {
  let baseDir: string;
  let targetDir: string;

  beforeEach(async () => {
    baseDir = await tmpDir();
    targetDir = await tmpDir();
    await createV3Fixture(baseDir);
  });

  it("copies only when file exists", async () => {
    const ok = await migrateSourceManifest(baseDir, targetDir);
    expect(ok).toBe(true);

    const targetPath = path.join(targetDir, "source-manifest.json");
    expect(existsSync(targetPath)).toBe(true);

    const content = JSON.parse(await readFile(targetPath, "utf8"));
    expect(content.version).toBe(3);
  });

  it("returns false when file does not exist", async () => {
    const emptyDir = await tmpDir();
    const target = await tmpDir();
    const ok = await migrateSourceManifest(emptyDir, target);
    expect(ok).toBe(false);
  });
});

describe("atomicWrite", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await tmpDir();
  });

  it("uses temp + rename pattern - file exists after write", async () => {
    const targetPath = path.join(tmp, "output", "file.md");
    await atomicWrite(targetPath, "content");
    expect(existsSync(targetPath)).toBe(true);
    const content = await readFile(targetPath, "utf8");
    expect(content).toBe("content");
  });
});

describe("ensureTargetSubdirs", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await tmpDir();
  });

  it("creates subdirectories for entity types", () => {
    const targetDir = path.join(tmp, "memory");
    ensureTargetSubdirs(targetDir, ["module", "flow", "decision", "reference"]);

    expect(existsSync(path.join(targetDir, "modules"))).toBe(true);
    expect(existsSync(path.join(targetDir, "flows"))).toBe(true);
    expect(existsSync(path.join(targetDir, "decisions"))).toBe(true);
    expect(existsSync(path.join(targetDir, "reference"))).toBe(true);
  });
});

describe("createStagingDir", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await tmpDir();
  });

  it("creates staging dir with subdirs and migration-plan.json", async () => {
    const stagingDir = await createStagingDir(tmp);
    expect(existsSync(path.join(stagingDir, "migrated"))).toBe(true);
    expect(existsSync(path.join(stagingDir, "skipped"))).toBe(true);
    expect(existsSync(path.join(stagingDir, "errors"))).toBe(true);
    expect(existsSync(path.join(stagingDir, "migration-plan.json"))).toBe(true);
  });
});

describe("runMigration", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await tmpDir();
    await createV3Fixture(baseDir);
  });

  it("migrated count matches discovery", async () => {
    const report = await runMigration(baseDir, {
      root: baseDir,
      skipCoverage: true,
    });

    expect(report.discovered).toBeGreaterThan(0);
    expect(report.migrated).toBeGreaterThan(0);
    expect(report.migrated).toBe(report.discovered);
  });

  it("with --dry-run -> 0 files written except staging", async () => {
    const report = await runMigration(baseDir, {
      root: baseDir,
      dryRun: true,
      skipCoverage: true,
    });

    expect(report.migrated).toBeGreaterThan(0);

    const targetDir = path.join(baseDir, ".ai", "memory");
    const cardFiles = await getAllFiles(targetDir);
    const mdFiles = cardFiles.filter((f) => f.endsWith(".md"));
    expect(mdFiles.length).toBe(0);
  });

  it("with existing targets and no --force -> skips existing", async () => {
    await runMigration(baseDir, {
      root: baseDir,
      skipCoverage: true,
    });

    const r2 = await runMigration(baseDir, {
      root: baseDir,
      skipCoverage: true,
    });
    expect(r2.skipped).toBeGreaterThan(0);
    expect(r2.migrated).toBe(0);
  });

  it("with --force -> overwrites existing", async () => {
    await runMigration(baseDir, {
      root: baseDir,
      skipCoverage: true,
    });

    const r2 = await runMigration(baseDir, {
      root: baseDir,
      force: true,
      skipCoverage: true,
    });
    expect(r2.migrated).toBeGreaterThan(0);
    expect(r2.skipped).toBe(0);
  });

  it("creates reference/ subdir if missing", async () => {
    await runMigration(baseDir, {
      root: baseDir,
      skipCoverage: true,
    });

    const targetDir = path.join(baseDir, ".ai", "memory");
    expect(existsSync(path.join(targetDir, "reference"))).toBe(true);
  });

  it("drops index.json and memory-contract.json (not copied to target)", async () => {
    await runMigration(baseDir, {
      root: baseDir,
      skipCoverage: true,
    });

    const targetDir = path.join(baseDir, ".ai", "memory");
    expect(existsSync(path.join(targetDir, "index.json"))).toBe(false);
    expect(existsSync(path.join(targetDir, "memory-contract.json"))).toBe(false);
  });

  it("malformed YAML frontmatter -> card skipped during discovery", async () => {
    const report = await runMigration(baseDir, {
      root: baseDir,
      skipCoverage: true,
    });
    expect(report.discovered).toBeGreaterThan(0);
    expect(report.migrated).toBeGreaterThan(0);
    const validFilenames = [
      "test-module.md", "test-flow.md", "test-decision.md",
      "test-arch.md", "test-ref.md", "MEMORY.md",
    ];
    expect(report.discovered).toBe(validFilenames.length);
  });
});
