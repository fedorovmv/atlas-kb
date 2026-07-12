import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileHash, treeHash, shaBytes, checkContextFreshness } from "../src/core/hashing.js";
import type { ContextPack } from "../src/core/types.js";

let tmpDir: string;
beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "hash-test-"));
});
afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("shaBytes", () => {
  it("returns hex string", () => {
    const hash = shaBytes(Buffer.from("hello"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("same input gives same output", () => {
    const a = shaBytes(Buffer.from("test"));
    const b = shaBytes(Buffer.from("test"));
    expect(a).toBe(b);
  });
  it("different input gives different output", () => {
    const a = shaBytes(Buffer.from("a"));
    const b = shaBytes(Buffer.from("b"));
    expect(a).not.toBe(b);
  });
});

describe("fileHash", () => {
  it("deterministic for same content", async () => {
    await writeFile(path.join(tmpDir, "a.txt"), "hello world", "utf8");
    await writeFile(path.join(tmpDir, "b.txt"), "hello world", "utf8");
    const hashA = await fileHash(path.join(tmpDir, "a.txt"));
    const hashB = await fileHash(path.join(tmpDir, "b.txt"));
    expect(hashA).toBe(hashB);
  });
  it("different content → different hash", async () => {
    await writeFile(path.join(tmpDir, "a.txt"), "hello", "utf8");
    await writeFile(path.join(tmpDir, "b.txt"), "world", "utf8");
    const hashA = await fileHash(path.join(tmpDir, "a.txt"));
    const hashB = await fileHash(path.join(tmpDir, "b.txt"));
    expect(hashA).not.toBe(hashB);
  });
});

describe("treeHash", () => {
  it("deterministic for same set", async () => {
    await writeFile(path.join(tmpDir, "a.txt"), "content A", "utf8");
    await writeFile(path.join(tmpDir, "b.txt"), "content B", "utf8");
    const hash1 = await treeHash([path.join(tmpDir, "a.txt"), path.join(tmpDir, "b.txt")]);
    const hash2 = await treeHash([path.join(tmpDir, "b.txt"), path.join(tmpDir, "a.txt")]);
    expect(hash1).toBe(hash2); // order-independent
  });
  it("empty list produces stable hash", async () => {
    const hash1 = await treeHash([]);
    const hash2 = await treeHash([]);
    expect(hash1).toBe(hash2);
  });
});

describe("checkContextFreshness", () => {
  it("matching hashes → fresh", async () => {
    await writeFile(path.join(tmpDir, "file.txt"), "test content", "utf8");
    const hash = await fileHash(path.join(tmpDir, "file.txt"));
    const pack: ContextPack = {
      query: "",
      selected: [],
      related: [],
      codeRefs: [],
      testRefs: [],
      markdown: "",
      sourceHashes: { "file.txt": hash },
    };
    const result = await checkContextFreshness(pack, tmpDir);
    expect(result.fresh).toBe(true);
    expect(result.staleFiles).toHaveLength(0);
  });
  it("changed file → stale", async () => {
    await writeFile(path.join(tmpDir, "file.txt"), "original", "utf8");
    const hash = await fileHash(path.join(tmpDir, "file.txt"));
    const pack: ContextPack = {
      query: "",
      selected: [],
      related: [],
      codeRefs: [],
      testRefs: [],
      markdown: "",
      sourceHashes: { "file.txt": hash },
    };
    // Change the file
    await writeFile(path.join(tmpDir, "file.txt"), "modified", "utf8");
    const result = await checkContextFreshness(pack, tmpDir);
    expect(result.fresh).toBe(false);
    expect(result.staleFiles).toContain("file.txt");
  });
  it("missing file → stale", async () => {
    const pack: ContextPack = {
      query: "",
      selected: [],
      related: [],
      codeRefs: [],
      testRefs: [],
      markdown: "",
      sourceHashes: { "nonexistent.txt": "abc123" },
    };
    const result = await checkContextFreshness(pack, tmpDir);
    expect(result.fresh).toBe(false);
    expect(result.staleFiles.length).toBeGreaterThan(0);
  });
  it("non-git repo → graceful skip, no error", async () => {
    const pack: ContextPack = {
      query: "",
      selected: [],
      related: [],
      codeRefs: [],
      testRefs: [],
      markdown: "",
      repositoryHead: "abc123",
    };
    const result = await checkContextFreshness(pack, tmpDir);
    // Non-git repo should not crash — should skip HEAD check gracefully
    expect(result).toBeDefined();
  });
  it("no hashes and no git head → fresh", async () => {
    const pack: ContextPack = {
      query: "",
      selected: [],
      related: [],
      codeRefs: [],
      testRefs: [],
      markdown: "",
    };
    const result = await checkContextFreshness(pack, tmpDir);
    expect(result.fresh).toBe(true);
    expect(result.staleFiles).toHaveLength(0);
  });
});
