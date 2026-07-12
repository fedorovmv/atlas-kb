import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initMemory } from "../src/commands/init.js";
import { getHookTemplates } from "../src/scaffold/templates.js";

const TEMPLATES_DIR = path.resolve(__dirname, "../src/scaffold/templates");

describe("hook template files", () => {
  it("pre-commit template exists", () => {
    expect(existsSync(path.join(TEMPLATES_DIR, "githooks/pre-commit"))).toBe(true);
  });

  it("pre-push template exists", () => {
    expect(existsSync(path.join(TEMPLATES_DIR, "githooks/pre-push"))).toBe(true);
  });

  it("post-checkout template exists", () => {
    expect(existsSync(path.join(TEMPLATES_DIR, "githooks/post-checkout"))).toBe(true);
  });

  it("post-merge template exists", () => {
    expect(existsSync(path.join(TEMPLATES_DIR, "githooks/post-merge"))).toBe(true);
  });

  it("pre-commit contains repo-memory validate", async () => {
    const content = await readFile(path.join(TEMPLATES_DIR, "githooks/pre-commit"), "utf8");
    expect(content).toContain("repo-memory");
    expect(content).toContain("validate");
  });

  it("pre-push contains --strict-warnings", async () => {
    const content = await readFile(path.join(TEMPLATES_DIR, "githooks/pre-push"), "utf8");
    expect(content).toContain("--strict-warnings");
  });

  it("post-checkout is non-blocking (contains & and exit 0)", async () => {
    const content = await readFile(path.join(TEMPLATES_DIR, "githooks/post-checkout"), "utf8");
    expect(content).toContain("&");
    expect(content).toContain("exit 0");
  });

  it("post-merge is non-blocking (contains & and exit 0)", async () => {
    const content = await readFile(path.join(TEMPLATES_DIR, "githooks/post-merge"), "utf8");
    expect(content).toContain("&");
    expect(content).toContain("exit 0");
  });

  it("all hooks contain local binary detection", async () => {
    const hooks = ["pre-commit", "pre-push", "post-checkout", "post-merge"];
    for (const hook of hooks) {
      const content = await readFile(path.join(TEMPLATES_DIR, "githooks", hook), "utf8");
      expect(content).toContain("node_modules/.bin/repo-memory");
    }
  });
});

describe("init --install-hooks", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "hooks-test-"));
    // Create a .git directory so installHooks doesn't skip
    await mkdir(path.join(tmpDir, ".git"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("copies hooks to .git/hooks/", async () => {
    await initMemory({ root: tmpDir, installHooks: true });

    const hooksDir = path.join(tmpDir, ".git", "hooks");
    expect(existsSync(path.join(hooksDir, "pre-commit"))).toBe(true);
    expect(existsSync(path.join(hooksDir, "pre-push"))).toBe(true);
    expect(existsSync(path.join(hooksDir, "post-checkout"))).toBe(true);
    expect(existsSync(path.join(hooksDir, "post-merge"))).toBe(true);
  });

  it("hooks are executable", async () => {
    await initMemory({ root: tmpDir, installHooks: true });

    const hooksDir = path.join(tmpDir, ".git", "hooks");
    const hooks = ["pre-commit", "pre-push", "post-checkout", "post-merge"];
    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, hook);
      const stats = await stat(hookPath);
      // Check executable bit: mode & 0o111 should be non-zero
      expect(stats.mode & 0o111).not.toBe(0);
    }
  });

  it("no .git → warning, no error", async () => {
    // Remove .git directory
    await rm(path.join(tmpDir, ".git"), { recursive: true, force: true });

    // Should not throw
    await expect(initMemory({ root: tmpDir, installHooks: true })).resolves.not.toThrow();

    // Hooks should not be installed
    expect(existsSync(path.join(tmpDir, ".git", "hooks", "pre-commit"))).toBe(false);
  });

  it("dryRun does not create hook files", async () => {
    await initMemory({ root: tmpDir, installHooks: true, dryRun: true });

    const hooksDir = path.join(tmpDir, ".git", "hooks");
    expect(existsSync(path.join(hooksDir, "pre-commit"))).toBe(false);
    expect(existsSync(path.join(hooksDir, "pre-push"))).toBe(false);
  });
});

describe("getHookTemplates", () => {
  it("returns 4 hook templates", () => {
    const hooks = getHookTemplates();
    expect(hooks).toHaveLength(4);
  });

  it("each hook has correct path", () => {
    const hooks = getHookTemplates();
    const paths = hooks.map(h => h.path);
    expect(paths).toContain(".git/hooks/pre-commit");
    expect(paths).toContain(".git/hooks/pre-push");
    expect(paths).toContain(".git/hooks/post-checkout");
    expect(paths).toContain(".git/hooks/post-merge");
  });
});
