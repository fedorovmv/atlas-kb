import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { buildArtifactIndex, artifactSearch } from "../src/core/artifactIndex.js";
import type { ArtifactIndex } from "../src/schemas/artifactIndex.js";

async function createTestRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "artifact-index-test-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return root;
}

describe("buildArtifactIndex", () => {
  it("scans .ai/memory/ and builds index (Phase 2 scope — docs/drafts deferred)", async () => {
    const root = await createTestRoot({
      ".ai/memory/module-auth.md": `---
entity_type: module
id: auth
title: Authentication Module
status: needs_review
authority: reviewed_memory
evidence_level: inferred
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-11
review_required: true
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Authentication Module

Some content here.
`,
      ".ai/memory/scenario-login-flow.md": `---
entity_type: scenario
id: login-flow
title: Login Flow
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
product_areas:
  - auth
  - user
aliases:
  - signin
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  requires_code_check_before_change: false
last_reviewed: 2026-07-11
review_required: false
---

# Login Flow

Content about login.
`,
    });
    const index = await buildArtifactIndex({ root });

    expect(index.entries).toHaveLength(2);
    expect(index.generatedAt).toBeDefined();

    const authEntry = index.entries.find((e) => e.path.includes("module-auth"));
    expect(authEntry).toBeDefined();
    expect(authEntry?.title).toBe("Authentication Module");
    expect(authEntry?.kind).toBe("module");
    expect(authEntry?.signals).toContain("current_behavior");
    expect(authEntry?.contentHash).toBeDefined();

    const loginEntry = index.entries.find((e) => e.path.includes("scenario-login-flow"));
    expect(loginEntry).toBeDefined();
    expect(loginEntry?.title).toBe("Login Flow");
    expect(loginEntry?.kind).toBe("scenario");
    expect(loginEntry?.signals).toContain("auth");
    expect(loginEntry?.signals).toContain("user");
    expect(loginEntry?.signals).toContain("signin");
    expect(loginEntry?.signals).toContain("current_behavior");

    await rm(root, { recursive: true, force: true });
  });

  it("binary file in .ai/memory/ -> skipped gracefully", async () => {
    const root = await createTestRoot({
      ".ai/memory/module-auth.md": `---
entity_type: module
id: auth
title: Auth
status: needs_review
authority: reviewed_memory
evidence_level: inferred
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-11
review_required: true
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Auth
`,
      ".ai/memory/screenshot.png": "FAKE-BINARY-PNG-DATA",
    });
    const index = await buildArtifactIndex({ root });

    expect(index.entries).toHaveLength(1);
    const entry = index.entries[0];
    expect(entry.path).not.toMatch(/\.png$/);

    await rm(root, { recursive: true, force: true });
  });

  it("file > 1MB -> skipped", async () => {
    const largeContent = "# Large\n\n" + "x".repeat(MAX_FILE_SIZE_BYTES + 100);
    const root = await createTestRoot({
      ".ai/memory/small.md": `---
entity_type: module
id: small
title: Small
status: needs_review
authority: reviewed_memory
evidence_level: inferred
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-11
review_required: true
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: true
---

# Small
`,
      ".ai/memory/huge.md": largeContent,
    });
    const index = await buildArtifactIndex({ root });

    expect(index.entries).toHaveLength(1);
    expect(index.entries[0].path).toContain("small");
    await rm(root, { recursive: true, force: true });
  });

  it("index saved to artifact-index.json", async () => {
    const root = await createTestRoot({
      ".ai/memory/decision-x.md": `---
entity_type: decision
id: decision-x
title: Decision X
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: stable
source_confidence: high
last_reviewed: 2026-07-11
review_required: false
knowledge_types:
  - design_rationale
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  requires_code_check_before_change: false
---

# Decision X
`,
    });
    await buildArtifactIndex({ root });

    const savedPath = path.join(root, ".ai", "memory-build", "latest", "artifact-index.json");
    const savedContent = JSON.parse(await readFile(savedPath, "utf8"));
    expect(savedContent.entries).toHaveLength(1);
    expect(savedContent.entries[0].title).toBe("Decision X");
    expect(savedContent.generatedAt).toBeDefined();

    await rm(root, { recursive: true, force: true });
  });
});

describe("artifactSearch", () => {
  function makeIndex(entries: Array<{
    path: string;
    title: string;
    kind?: string;
    signals?: string[];
    contentHash?: string;
  }>): ArtifactIndex {
    return {
      entries: entries.map((e) => ({
        path: e.path,
        title: e.title,
        kind: e.kind ?? "unknown",
        signals: e.signals ?? [],
        contentHash: e.contentHash ?? "hash",
      })),
      generatedAt: "2026-01-01T00:00:00Z",
    };
  }

  it("title match -> 4 points", () => {
    const index = makeIndex([
      { path: ".ai/memory/auth.md", title: "Authentication Module", kind: "module" },
    ]);
    const hits = artifactSearch("authentication", index);
    expect(hits).toHaveLength(1);
    expect(hits[0].score).toBe(4);
  });

  it("haystack match -> 1 point", () => {
    const index = makeIndex([
      {
        path: ".ai/memory/decisions.md",
        title: "Design Decisions",
        kind: "decision",
        signals: ["auth", "security"],
      },
    ]);
    // "security" is not in the title, but it is in signals (part of haystack)
    const hits = artifactSearch("security", index);
    expect(hits).toHaveLength(1);
    expect(hits[0].score).toBe(1);
  });

  it("top 8 returned", () => {
    const entries = [];
    for (let i = 0; i < 20; i++) {
      entries.push({
        path: `.ai/memory/item-${i}.md`,
        title: `Test Item ${i}`,
        kind: "module",
        signals: ["test"],
      });
    }
    const index = makeIndex(entries);
    const hits = artifactSearch("test", index);
    expect(hits).toHaveLength(8);
  });

  it("empty query -> empty results", () => {
    const index = makeIndex([
      { path: ".ai/memory/a.md", title: "A", kind: "module" },
    ]);
    expect(artifactSearch("", index)).toEqual([]);
    expect(artifactSearch("   ", index)).toEqual([]);
  });
});

// Max file size in bytes (1 MB) — matches the constant in artifactIndex.ts
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;
