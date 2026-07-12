import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { recordDispatchAttempt, detectImpersonation, checkDispatchAdvisory } from "../src/core/dispatch.js";
import { validateMemory } from "../src/core/validate.js";
import type { SpecialistAttempt } from "../src/schemas/dispatch.js";

function makeValidAttempt(overrides: Partial<SpecialistAttempt> = {}): SpecialistAttempt {
  return {
    attemptId: "test-1234567890ab",
    phase: "discovery-semantic",
    expectedAgent: "memory-extractor",
    requestedAgent: "memory-extractor",
    actualAgent: "memory-extractor",
    tool: "task",
    runtime: "opencode",
    status: "named-task",
    timestamp: new Date().toISOString(),
    description: undefined,
    notes: undefined,
    ...overrides,
  };
}

describe("recordDispatchAttempt", () => {
  it("writes to JSONL", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dispatch-test-"));
    try {
      await mkdir(path.join(root, ".ai/memory-build/latest"), { recursive: true });
      const id = await recordDispatchAttempt({
        phase: "code-evidence",
        expectedAgent: "memory-coder",
        requestedAgent: "memory-coder",
        actualAgent: "memory-coder",
        tool: "task",
        runtime: "opencode",
        status: "named-task",
      }, { root });
      expect(id).toBeDefined();

      const content = await import("node:fs/promises").then(m => m.readFile(path.join(root, ".ai/memory-build/latest/specialist-attempts.jsonl"), "utf8"));
      const line = content.trim();
      const parsed = JSON.parse(line);
      expect(parsed.phase).toBe("code-evidence");
      expect(parsed.attemptId).toBe(id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("attemptId = SHA-256[:16]", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dispatch-id-test-"));
    try {
      await mkdir(path.join(root, ".ai/memory-build/latest"), { recursive: true });
      const attemptInput = {
        phase: "rationale-extraction" as const,
        expectedAgent: "memory-analyst",
        requestedAgent: "memory-analyst",
        actualAgent: "memory-analyst",
        tool: "task" as const,
        runtime: "opencode" as const,
        status: "named-task" as const,
      };
      const id = await recordDispatchAttempt(attemptInput, { root });
      // attemptId should be exactly 16 hex chars (SHA-256[:16])
      expect(id).toMatch(/^[0-9a-f]{16}$/);

      // Read what was written to verify it
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(path.join(root, ".ai/memory-build/latest/specialist-attempts.jsonl"), "utf8");
      const parsed = JSON.parse(content.trim());
      expect(parsed.attemptId).toBe(id);
      expect(parsed.attemptId).toMatch(/^[0-9a-f]{16}$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("detectImpersonation", () => {
  it("generic agent name → isImpersonation=true", () => {
    const attempt = makeValidAttempt({ actualAgent: "explore" });
    const result = detectImpersonation(attempt);
    expect(result.isImpersonation).toBe(true);
    expect(result.reasons.some(r => r.includes("generic agent name"))).toBe(true);
  });

  it("ты — pattern → isImpersonation=true", () => {
    const attempt = makeValidAttempt({ notes: "ты — специалист" });
    const result = detectImpersonation(attempt);
    expect(result.isImpersonation).toBe(true);
    expect(result.reasons.some(r => r.includes("impersonation pattern"))).toBe(true);
  });

  it("you are pattern → isImpersonation=true", () => {
    const attempt = makeValidAttempt({ description: "you are the specialist" });
    const result = detectImpersonation(attempt);
    expect(result.isImpersonation).toBe(true);
    expect(result.reasons.some(r => r.includes("impersonation pattern"))).toBe(true);
  });

  it("tool != \"task\" → isImpersonation=true", () => {
    const attempt = makeValidAttempt({ tool: "command" });
    const result = detectImpersonation(attempt);
    expect(result.isImpersonation).toBe(true);
    expect(result.reasons.some(r => r.includes('tool must be "task"'))).toBe(true);
  });

  it("valid attempt → isImpersonation=false", () => {
    const attempt = makeValidAttempt();
    const result = detectImpersonation(attempt);
    expect(result.isImpersonation).toBe(false);
    expect(result.reasons).toEqual([]);
  });
});

describe("checkDispatchAdvisory", () => {
  it("returns warnings (not errors)", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dispatch-advisory-"));
    try {
      await mkdir(path.join(root, ".ai/memory-build/latest"), { recursive: true });
      // Write a valid impersonation attempt
      const attempt = makeValidAttempt({ actualAgent: "explore" });
      await writeFile(
        path.join(root, ".ai/memory-build/latest/specialist-attempts.jsonl"),
        JSON.stringify(attempt) + "\n",
        "utf8",
      );

      const result = await checkDispatchAdvisory({ root });
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.attemptsChecked).toBe(1);
      // The function returns "warnings", not "errors"
      expect(result).toHaveProperty("warnings");
      expect(result).not.toHaveProperty("errors");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("empty JSONL → empty warnings", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dispatch-empty-"));
    try {
      await mkdir(path.join(root, ".ai/memory-build/latest"), { recursive: true });
      await writeFile(
        path.join(root, ".ai/memory-build/latest/specialist-attempts.jsonl"),
        "",
        "utf8",
      );

      const result = await checkDispatchAdvisory({ root });
      expect(result.warnings).toEqual([]);
      expect(result.attemptsChecked).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("impersonation attempt → warning", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dispatch-warn-"));
    try {
      await mkdir(path.join(root, ".ai/memory-build/latest"), { recursive: true });
      const attempt = makeValidAttempt({
        actualAgent: "general",
        notes: "you are the specialist for this task",
      });
      await writeFile(
        path.join(root, ".ai/memory-build/latest/specialist-attempts.jsonl"),
        JSON.stringify(attempt) + "\n",
        "utf8",
      );

      const result = await checkDispatchAdvisory({ root });
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes("generic agent name"))).toBe(true);
      expect(result.warnings.some(w => w.includes("impersonation pattern"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("no JSONL file → empty warnings", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dispatch-no-file-"));
    try {
      const result = await checkDispatchAdvisory({ root });
      expect(result.warnings).toEqual([]);
      expect(result.attemptsChecked).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("validate --check-dispatch", () => {
  it("without attempts → empty warnings (not error)", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dispatch-validate-"));
    try {
      // Create a minimal valid memory structure
      await mkdir(path.join(root, ".ai/memory/modules"), { recursive: true });
      await writeFile(
        path.join(root, ".ai/memory/modules/test-card.md"),
        `---
entity_type: module
id: test-card
title: Test Card
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Test Card

## Responsibilities
Test
## Non-responsibilities
Test
## Current behavior
Test
## Related scenarios
Test
## Related decisions
Test
## Code references
- test-card at src/test-card.ts:1 (testCard)
## Test references
- test-card at tests/test-card.test.ts:1 (testCard)
## Known risks
Test
## Open questions
Test
## Why these boundaries
Test
`,
        "utf8",
      );

      const result = await validateMemory({ root, checkDispatch: true });
      // Should not produce errors - no JSONL file exists, so advisory is empty
      expect(result.errors.length).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
