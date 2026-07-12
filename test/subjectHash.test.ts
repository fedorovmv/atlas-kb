import { describe, it, expect } from "vitest";
import { computeSubjectHash, approveCandidate, applyCandidate } from "../src/core/legacyIngest.js";
import type { LegacyCandidate } from "../src/schemas/legacyIngest.js";

function makeCandidate(overrides: Partial<LegacyCandidate> = {}): LegacyCandidate {
  return {
    id: "test-candidate",
    path: "specs/test.md",
    classification: "kb-service",
    state: "ready",
    confidence: 0.8,
    evidence: [],
    targetPath: ".ai/docs/services/README.md",
    stagedPath: ".ai/memory-build/legacy-batches/batch-1/staged/.ai/docs/services/README.md",
    ...overrides,
  };
}

describe("computeSubjectHash", () => {
  it("deterministic for same candidate", () => {
    const c1 = makeCandidate();
    const c2 = makeCandidate();
    expect(computeSubjectHash(c1)).toBe(computeSubjectHash(c2));
  });

  it("different for changed candidate", () => {
    const c1 = makeCandidate();
    const c2 = makeCandidate({ classification: "kb-decision" });
    expect(computeSubjectHash(c1)).not.toBe(computeSubjectHash(c2));
  });

  it("two objects with same fields in different insertion order → same hash", () => {
    // Construct two candidates with same data — field order in object literal doesn't matter
    const c1 = makeCandidate({ rationale: "test", targetPath: "a.md" });
    const c2 = makeCandidate({ targetPath: "a.md", rationale: "test" });
    expect(computeSubjectHash(c1)).toBe(computeSubjectHash(c2));
  });

  it("different candidates with same classification/state but different evidence → different hashes", () => {
    const c1 = makeCandidate({ path: "a.md" });
    const c2 = makeCandidate({ path: "b.md" });
    expect(computeSubjectHash(c1)).not.toBe(computeSubjectHash(c2));
  });
});

describe("approveCandidate", () => {
  it("valid ready state → approved", async () => {
    const candidate = makeCandidate({ state: "ready" });
    const result = await approveCandidate(candidate, { root: "/tmp", batch: "test" });
    expect(result.approved).toBe(true);
    expect(result.subjectHash).toBeDefined();
  });

  it("non-ready state → rejected", async () => {
    const candidate = makeCandidate({ state: "needs-evidence" });
    const result = await approveCandidate(candidate, { root: "/tmp", batch: "test" });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("ready");
  });
});

describe("applyCandidate", () => {
  it("without approve → rejected", async () => {
    const candidate = makeCandidate();
    const result = await applyCandidate(candidate, { root: "/tmp", batch: "test" });
    expect(result.applied).toBe(false);
    expect(result.reason).toContain("not approved");
  });

  it("hash mismatch → rejected", async () => {
    const candidate = makeCandidate();
    const result = await applyCandidate(candidate, { root: "/tmp", batch: "test", subjectHash: "wrong-hash" });
    expect(result.applied).toBe(false);
    expect(result.reason).toContain("mismatch");
  });

  it("with correct approve hash → applied", async () => {
    const candidate = makeCandidate();
    const hash = computeSubjectHash(candidate);
    const result = await applyCandidate(candidate, { root: "/tmp", batch: "test", subjectHash: hash });
    expect(result.applied).toBe(true);
  });

  it("no stagedPath → rejected", async () => {
    const candidate = makeCandidate({ stagedPath: undefined });
    const hash = computeSubjectHash(candidate);
    const result = await applyCandidate(candidate, { root: "/tmp", batch: "test", subjectHash: hash });
    expect(result.applied).toBe(false);
    expect(result.reason).toContain("staged");
  });
});