import { describe, it, expect, vi, beforeEach } from "vitest";

const GRACEFUL_MSG = "OpenSpec not installed. Install with: npm i @fission-ai/openspec";

const mockFn = vi.fn();

vi.mock("node:child_process", () => ({ execFile: mockFn }));

vi.mock("node:util", () => ({
  promisify: vi.fn((fn: (...args: any[]) => void) => {
    return (...args: any[]) =>
      new Promise((resolve, reject) => {
        fn(...args, (err: any, result: any) => (err ? reject(err) : resolve(result)));
      });
  }),
}));

function makeItSucceed(output = "ok") {
  mockFn.mockImplementation((_c: string, _a: string[], _opts: any, cb?: (e: any, r?: any) => void) => {
    const callback = typeof _opts === "function" ? _opts : cb!;
    callback(null, { stdout: output, stderr: "" });
  });
}

function makeItFail() {
  mockFn.mockImplementation((_c: string, _a: string[], _opts: any, cb?: (e: any) => void) => {
    const callback = typeof _opts === "function" ? _opts : cb!;
    callback(new Error("ENOENT: command not found"));
  });
}

beforeEach(() => {
  mockFn.mockReset();
});

describe("checkOpenspecInstalled", () => {
  it("returns false when not installed", async () => {
    makeItFail();
    const mod = await import("../src/commands/openspec.js");
    expect(await mod.checkOpenspecInstalled()).toBe(false);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith("openspec", ["--version"], expect.any(Function));
    expect(mockFn).toHaveBeenCalledWith("npx", ["@fission-ai/openspec", "--version"], expect.any(Function));
  });

  it("returns true when installed via direct CLI", async () => {
    makeItSucceed();
    const mod = await import("../src/commands/openspec.js");
    expect(await mod.checkOpenspecInstalled()).toBe(true);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith("openspec", ["--version"], expect.any(Function));
  });

  it("returns true when installed via npx fallback", async () => {
    let callCount = 0;
    mockFn.mockImplementation((_c: string, _a: string[], _opts: any, cb?: (e: any, r?: any) => void) => {
      const callback = typeof _opts === "function" ? _opts : cb!;
      callCount++;
      if (callCount === 1) callback(new Error("ENOENT"));
      else callback(null, { stdout: "0.1.0", stderr: "" });
    });
    const mod = await import("../src/commands/openspec.js");
    expect(await mod.checkOpenspecInstalled()).toBe(true);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe("openspecNewCommand", () => {
  it("prints graceful message when not installed", async () => {
    makeItFail();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { openspecNewCommand } = await import("../src/commands/openspec.js");
    await openspecNewCommand({});
    expect(logSpy).toHaveBeenCalledWith(GRACEFUL_MSG);
    logSpy.mockRestore();
  });

  it("delegates to npx when installed", async () => {
    makeItSucceed("created feature-x");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { openspecNewCommand } = await import("../src/commands/openspec.js");
    await openspecNewCommand({ name: "feature-x", json: true });
    // mockFn gets: (command, args, options?, cb?) — promisify passes cb last
    // First call is checkOpenspecInstalled → "openspec" ["--version"]
    // Second call is runOpenspec → "npx" ["@fission-ai/openspec", "new", "feature-x", "--json"]
    expect(mockFn).toHaveBeenCalledWith("openspec", ["--version"], expect.any(Function));
    expect(mockFn).toHaveBeenCalledWith(
      "npx",
      ["@fission-ai/openspec", "new", "feature-x", "--json"],
      { maxBuffer: 4194304 },
      expect.any(Function),
    );
    logSpy.mockRestore();
  });
});

describe("openspecStatusCommand", () => {
  it("prints graceful message when not installed", async () => {
    makeItFail();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { openspecStatusCommand } = await import("../src/commands/openspec.js");
    await openspecStatusCommand({});
    expect(logSpy).toHaveBeenCalledWith(GRACEFUL_MSG);
    logSpy.mockRestore();
  });
});

describe("openspecCheckCommand", () => {
  it("prints graceful message when not installed", async () => {
    makeItFail();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { openspecCheckCommand } = await import("../src/commands/openspec.js");
    await openspecCheckCommand({});
    expect(logSpy).toHaveBeenCalledWith(GRACEFUL_MSG);
    logSpy.mockRestore();
  });
});

describe("openspecArchiveCommand", () => {
  it("prints graceful message when not installed", async () => {
    makeItFail();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { openspecArchiveCommand } = await import("../src/commands/openspec.js");
    await openspecArchiveCommand({ name: "my-feature" });
    expect(logSpy).toHaveBeenCalledWith(GRACEFUL_MSG);
    logSpy.mockRestore();
  });
});
