import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  SourceContentMapSchema,
  SectionMapEntrySchema,
} from "../src/schemas/sourceContentMap.js";
import { buildSourceContentMap, buildAllContentMaps } from "../src/core/contentMap.js";
import type { FileRecord } from "../src/schemas/discovery.js";
import type { MemoryCard } from "../src/core/types.js";
import type { MemoryFrontmatter } from "../src/schemas/frontmatter.js";
import { MemoryFrontmatterSchema } from "../src/schemas/frontmatter.js";
import { z } from "zod";

function makeCard(overrides?: {
  metaPartial?: Partial<MemoryFrontmatter>;
  relativePath?: string;
}): MemoryCard {
  const meta = MemoryFrontmatterSchema.parse({
    entity_type: "module",
    id: "test-card",
    title: "Test Card",
    status: "current",
    authority: "reviewed_memory",
    evidence_level: "code_confirmed",
    stability: "stable",
    source_confidence: "high",
    last_reviewed: "2026-07-09",
    review_required: false,
    knowledge_types: ["current_behavior"],
    aliases: [],
    product_areas: [],
    code_refs: [],
    usage_policy: {
      can_answer_current_behavior: true,
      can_generate_code_from: true,
      can_use_as_rationale: true,
      can_use_as_example: false,
      requires_code_check_before_change: true,
    },
    ...overrides?.metaPartial,
  });

  return {
    path: `/base/.ai/memory/modules/test-card.md`,
    relativePath: overrides?.relativePath ?? ".ai/memory/modules/test-card.md",
    meta,
    body: "Test card body",
    raw: "---\n---\nTest card body",
  };
}

function makeFileRecord(pathSuffix: string, content: string, kindOverrides?: Partial<FileRecord>): FileRecord {
  return {
    path: pathSuffix,
    kind: "doc",
    language: "markdown",
    basename: path.basename(pathSuffix),
    dirname: path.dirname(pathSuffix),
    sizeBytes: content.length,
    signals: [],
    topics: [],
    ...kindOverrides,
  };
}

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "content-map-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("SectionMapEntrySchema", () => {
  it("parses valid entry", () => {
    const result = SectionMapEntrySchema.parse({
      heading: "Test Heading",
      startLine: 1,
      endLine: 10,
    });
    expect(result.heading).toBe("Test Heading");
    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(10);
    expect(result.keywordTopics).toEqual([]);
  });
});

describe("buildSourceContentMap", () => {
  it("Markdown with 3 headings → sectionMap length 3", async () => {
    const mdContent = `---
title: Test Doc
---
Some intro paragraph here.

## First Section

Content of first section with details.

## Second Section

Content of second section.

## Third Section

Final section content.
`;
    const filePath = path.join(tmpRoot, "doc.md");
    await writeFile(filePath, mdContent, "utf8");
    const file: FileRecord = makeFileRecord(filePath, mdContent);

    const result = await buildSourceContentMap(file, []);

    expect(result.sectionMap).toHaveLength(3);
    expect(result.sectionMap[0].heading).toBe("First Section");
    expect(result.sectionMap[0].startLine).toBe(6);
    expect(result.sectionMap[1].heading).toBe("Second Section");
    expect(result.sectionMap[1].startLine).toBe(10);
    expect(result.sectionMap[2].heading).toBe("Third Section");
    expect(result.sectionMap[2].startLine).toBe(14);
  });

  it("heading without content → summary empty", async () => {
    const mdContent = `
## Empty Heading

## Next Section

Some content here.
`;
    const filePath = path.join(tmpRoot, "empty-heading.md");
    await writeFile(filePath, mdContent, "utf8");
    const file: FileRecord = makeFileRecord(filePath, mdContent);

    const result = await buildSourceContentMap(file, []);

    const emptySection = result.sectionMap.find(
      (s) => s.heading === "Empty Heading",
    );
    expect(emptySection).toBeDefined();
    expect(emptySection!.summary).toBeUndefined();
  });

  it("Go file with package → component extracted", async () => {
    const goContent = `package registry

import "fmt"

func FilterCards() {
  fmt.Println("filtering")
}
`;
    const filePath = path.join(tmpRoot, "internal/registry/filter.go");
    await mkdir(path.join(tmpRoot, "internal", "registry"), { recursive: true });
    await writeFile(filePath, goContent, "utf8");
    const file: FileRecord = makeFileRecord(
      filePath,
      goContent,
      { kind: "code", language: "go", topics: [] },
    );

    const result = await buildSourceContentMap(file, []);

    expect(result.components).toContain("registry");
    expect(result.classifiers.sourceType).toBe("code");
  });

  it("targetCards for file with topics → card with matching alias", async () => {
    const mdContent = `## Authentication Flow

Describes the authentication flow and token exchange process.

## API Gateway

The API gateway routing configuration.
`;
    const filePath = path.join(tmpRoot, "docs/auth.md");
    await mkdir(path.join(tmpRoot, "docs"), { recursive: true });
    await writeFile(filePath, mdContent, "utf8");
    const file: FileRecord = makeFileRecord(filePath, mdContent);

    const card = makeCard({
      metaPartial: {
        aliases: ["authentication", "auth-flow"],
        product_areas: ["security"],
      },
      relativePath: ".ai/memory/modules/auth-module.md",
    });

    const result = await buildSourceContentMap(file, [card]);

    expect(result.targetCards).toContain(".ai/memory/modules/auth-module.md");
  });

  it("contentMapId deterministic", async () => {
    const mdContent = `## Deterministic Test

Same content produces same hash.
`;
    const filePath = path.join(tmpRoot, "deterministic.md");
    await writeFile(filePath, mdContent, "utf8");
    const file: FileRecord = makeFileRecord(filePath, mdContent);

    const result1 = await buildSourceContentMap(file, []);
    const result2 = await buildSourceContentMap(file, []);

    expect(result1.contentMapId).toBe(result2.contentMapId);
    expect(result1.contentMapId).toHaveLength(16);
  });
});

describe("buildAllContentMaps", () => {
  it("JSONL with N records for N files", async () => {
    const file1Content = `## Module A

Content for module A.

## Section B of A

More content.
`;
    const file2Content = `package agentcard

type Card struct {}
`;
    const file3Content = `## Overview

Some overview text.
`;

    const dir1 = path.join(tmpRoot, "internal", "module-a");
    const dir2 = path.join(tmpRoot, "pkg", "agentcard");
    const dir3 = path.join(tmpRoot, "docs");
    await mkdir(dir1, { recursive: true });
    await mkdir(dir2, { recursive: true });
    await mkdir(dir3, { recursive: true });

    const f1Path = path.join(dir1, "main.go");
    const f2Path = path.join(dir2, "card.go");
    const f3Path = path.join(dir3, "overview.md");
    await writeFile(f1Path, file1Content, "utf8");
    await writeFile(f2Path, file2Content, "utf8");
    await writeFile(f3Path, file3Content, "utf8");

    const files: FileRecord[] = [
      makeFileRecord(f1Path, file1Content, { kind: "code", language: "go" }),
      makeFileRecord(f2Path, file2Content, { kind: "code", language: "go" }),
      makeFileRecord(f3Path, file3Content, { kind: "doc", language: "markdown" }),
    ];

    const discovery = {
      root: tmpRoot,
      files,
      candidateModules: [],
    };

    const buildDir = path.join(tmpRoot, "build-dir");
    const result = await buildAllContentMaps(discovery, [], { root: tmpRoot, buildDir });

    expect(result.maps).toHaveLength(3);
    expect(result.path).toBe(path.resolve(buildDir, "source-content-map.jsonl"));

    // Verify JSONL file content
    const jsonlContent = await readFile(result.path, "utf8");
    const lines = jsonlContent.trim().split("\n");
    expect(lines).toHaveLength(3);

    // Each line should validate against the schema
    for (const line of lines) {
      const parsed = SourceContentMapSchema.parse(JSON.parse(line));
      expect(parsed.contentMapId).toBeDefined();
      expect(parsed.sha256).toBeDefined();
    }
  });
});

describe("SourceContentMapSchema", () => {
  it("valid entry → ok", () => {
    const validEntry = {
      contentMapId: "abc123def4567890",
      path: "/some/path",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      title: "Test",
      classifiers: {
        sourceType: "doc",
        memoryIntents: [],
        tags: [],
      },
      topics: ["test"],
      components: [],
      services: [],
      referencedPaths: [],
      targetCards: [],
      sectionMap: [],
    };
    const result = SourceContentMapSchema.parse(validEntry);
    expect(result.contentMapId).toBe("abc123def4567890");
    expect(result.topics).toEqual(["test"]);
  });

  it("without contentMapId → ZodError", () => {
    const invalidEntry = {
      path: "/some/path",
      sha256: "abc123",
      classifiers: {
        sourceType: "doc",
        memoryIntents: [],
        tags: [],
      },
      topics: [],
      components: [],
      services: [],
      referencedPaths: [],
      targetCards: [],
      sectionMap: [],
    };
    expect(() => SourceContentMapSchema.parse(invalidEntry)).toThrow();
  });
});
