import { describe, it, expect } from "vitest";
import { mkdir, writeFile, rm, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { bootstrapMemory } from "../src/core/bootstrapMemory.js";
import { reconcileMemory } from "../src/core/reconcile.js";

describe("reconcile", () => {
  it("reports stale references after file deletion", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-stale-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await bootstrapMemory({ root: dest });
    await rm(path.join(dest, "internal/registry/access_filter.go"));
    const report = await reconcileMemory({ root: dest });
    expect(report.staleRefs.length).toBeGreaterThan(0);
    await rm(dest, { recursive: true, force: true });
  });

  it("reports no stale refs when files exist", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-clean-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await bootstrapMemory({ root: dest });
    const report = await reconcileMemory({ root: dest });
    expect(report.staleRefs.length).toBe(0);
    await rm(dest, { recursive: true, force: true });
  });

  it("is read-only — does not modify memory", async () => {
    const dest = await mkdtemp(path.join(tmpdir(), "reconcile-readonly-"));
    await mkdir(path.join(dest, "internal/registry"), { recursive: true });
    await writeFile(path.join(dest, "internal/registry/access_filter.go"), "package registry\n\nfunc Filter() {}\n", "utf8");
    await bootstrapMemory({ root: dest });
    const before = await readdir(path.join(dest, ".ai/memory/modules/"));
    await reconcileMemory({ root: dest });
    const after = await readdir(path.join(dest, ".ai/memory/modules/"));
    expect(after).toEqual(before);
    await rm(dest, { recursive: true, force: true });
  });
});
