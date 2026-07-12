import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mapDocsPath, migrateDoc, discoverV3Docs } from "../src/core/migrateDocs.js";
import { MemoryFrontmatterSchema } from "../src/schemas/frontmatter.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "docs-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("mapDocsPath", () => {
  it('maps "service" node_type to modules subdir', () => {
    expect(mapDocsPath("knowledge/docs/services/auth.md", "service")).toBe(
      ".ai/memory/modules/auth.md",
    );
  });

  it('maps "runbook" node_type to ops subdir', () => {
    expect(mapDocsPath("knowledge/docs/runbooks/deploy.md", "runbook")).toBe(
      ".ai/memory/ops/deploy.md",
    );
  });

  it('maps "gotcha" node_type to gotchas subdir', () => {
    expect(mapDocsPath("knowledge/docs/gotchas/x.md", "gotcha")).toBe(
      ".ai/memory/gotchas/x.md",
    );
  });

  it('maps "guide" node_type to reference subdir', () => {
    expect(mapDocsPath("knowledge/docs/guides/api.md", "guide")).toBe(
      ".ai/memory/reference/api.md",
    );
  });

  it('maps "index" node_type to top-level', () => {
    expect(mapDocsPath("knowledge/docs/index.md", "index")).toBe(
      ".ai/memory/index.md",
    );
  });

  it("defaults unknown node_type to reference subdir", () => {
    expect(mapDocsPath("knowledge/docs/services/unknown.md", "unknown_type")).toBe(
      ".ai/memory/reference/unknown.md",
    );
  });
});

describe("migrateDoc", () => {
  it("produces frontmatter with all required fields", () => {
    const v3Doc = {
      relativePath: "knowledge/docs/services/auth.md",
      frontmatter: {
        node_type: "service",
        title: "Auth Service",
        status: "active",
        updated: "2025-01-15",
      },
      body: "# Auth Service\n\nThe authentication module.",
      filename: "auth.md",
    };

    const result = migrateDoc(v3Doc);

    expect(result.frontmatter.entity_type).toBe("module");
    expect(result.frontmatter.id).toBe("auth");
    expect(result.frontmatter.title).toBe("Auth Service");
    expect(result.frontmatter.status).toBe("current");
    expect(result.frontmatter.authority).toBe("reviewed_memory");
    expect(result.frontmatter.evidence_level).toBe("reviewed_doc");
    expect(result.frontmatter.stability).toBe("stable");
    expect(result.frontmatter.source_confidence).toBe("medium");
    expect(result.frontmatter.last_reviewed).toBe("2025-01-15");
    expect(result.frontmatter.review_required).toBe(true);
    expect(result.frontmatter.knowledge_types).toEqual(["current_behavior"]);
    expect(result.frontmatter.product_areas).toEqual([]);
    expect(result.frontmatter.usage_policy).toEqual({
      can_answer_current_behavior: true,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      can_use_as_example: false,
      requires_code_check_before_change: true,
      requires_warning: false,
    });
    expect(result.body).toContain("<!-- v3: node_type=service -->");

    // Validate full schema compliance (N2 fix)
    const parseResult = MemoryFrontmatterSchema.safeParse(result.frontmatter);
    expect(parseResult.success).toBe(true);
    expect(result.body).toContain("# Auth Service");
    expect(result.warnings).toEqual([]);
  });

  it("with missing node_type produces warning and defaults to reference", () => {
    const v3Doc = {
      relativePath: "knowledge/docs/unknown/xyz.md",
      frontmatter: {
        node_type: "totally_unknown",
      },
      body: "# Unknown Doc",
      filename: "xyz.md",
    };

    const result = migrateDoc(v3Doc);

    expect(result.frontmatter.entity_type).toBe("reference");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Unknown node_type");
  });

  it("derives title from filename when title is missing", () => {
    const v3Doc = {
      relativePath: "knowledge/docs/reference/some-cool_thing.md",
      frontmatter: {
        node_type: "reference",
      },
      body: "# Content",
      filename: "some-cool_thing.md",
    };

    const result = migrateDoc(v3Doc);

    expect(result.frontmatter.title).toBe("Some Cool Thing");
  });

  it("with noAutoReview sets review_required to false", () => {
    const v3Doc = {
      relativePath: "knowledge/docs/services/auth.md",
      frontmatter: {
        node_type: "service",
      },
      body: "# Auth",
      filename: "auth.md",
    };

    const result = migrateDoc(v3Doc, { noAutoReview: true });

    expect(result.frontmatter.review_required).toBe(false);
  });

  it("maps v3 statuses correctly", () => {
    const statusCases = [
      { v3: "active", expected: "current" },
      { v3: "draft", expected: "proposed" },
      { v3: "deprecated", expected: "deprecated" },
      { v3: "archived", expected: "historical" },
      { v3: "", expected: "current" },
    ];

    for (const { v3, expected } of statusCases) {
      const doc = {
        relativePath: "knowledge/docs/test.md",
        frontmatter: { node_type: "reference", status: v3 || undefined },
        body: "# Test",
        filename: "test.md",
      };
      const result = migrateDoc(doc);
      expect(result.frontmatter.status, `v3 status "${v3}"`).toBe(expected);
    }
  });

  it("maps v3 stability correctly", () => {
    const stabilityCases = [
      { v3Status: "active", expected: "stable" },
      { v3Status: "draft", expected: "evolving" },
      { v3Status: "deprecated", expected: "deprecated" },
      { v3Status: "archived", expected: "deprecated" },
      { v3Status: "", expected: "unknown" },
    ];

    for (const { v3Status, expected } of stabilityCases) {
      const doc = {
        relativePath: "knowledge/docs/test.md",
        frontmatter: { node_type: "reference", status: v3Status || undefined },
        body: "# Test",
        filename: "test.md",
      };
      const result = migrateDoc(doc);
      expect(result.frontmatter.stability, `v3 status "${v3Status}"`).toBe(expected);
    }
  });
});

describe("discoverV3Docs", () => {
  it("finds .md files in a temp knowledge/docs/ dir", async () => {
    const docsDir = path.join(tmpDir, "knowledge", "docs", "services");
    await mkdir(docsDir, { recursive: true });

    await writeFile(
      path.join(docsDir, "auth.md"),
      "---\nnode_type: service\ntitle: Auth\nstatus: active\n---\n# Auth Service",
    );

    const gotchasDir = path.join(tmpDir, "knowledge", "docs", "gotchas");
    await mkdir(gotchasDir, { recursive: true });

    await writeFile(
      path.join(gotchasDir, "cache-bug.md"),
      "---\nnode_type: gotcha\ntitle: Cache Bug\n---\n# Cache Bug Gotcha",
    );

    const docs = await discoverV3Docs(tmpDir);

    expect(docs).toHaveLength(2);
    expect(docs[0].frontmatter.node_type).toBe("gotcha");
    expect(docs[0].filename).toBe("cache-bug.md");
    expect(docs[1].frontmatter.node_type).toBe("service");
    expect(docs[1].filename).toBe("auth.md");
  });

  it("skips files without frontmatter", async () => {
    const docsDir = path.join(tmpDir, "knowledge", "docs");
    await mkdir(docsDir, { recursive: true });

    await writeFile(
      path.join(docsDir, "no-frontmatter.md"),
      "# Just a plain markdown file",
    );

    const docs = await discoverV3Docs(tmpDir);
    expect(docs).toHaveLength(0);
  });
});
