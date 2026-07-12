import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  loadSessions,
  sessionOpen,
  sessionClose,
  checkSessions,
  getActiveSessionSummary,
  getSessionLanesSummary,
} from "../src/core/sessionTracking.js";
import type { ExecutionSession } from "../src/schemas/session.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "session-test-"));
});

describe("sessionOpen", () => {
  it("creates new lane with status=active", async () => {
    await sessionOpen({
      root: tmpDir,
      laneKey: "feature-x",
      phase: "implementation",
      sessionId: "sess-001",
    });

    const sessions = await loadSessions(tmpDir);
    const lane = sessions.lanes.find((l) => l.laneKey === "feature-x");
    expect(lane).toBeDefined();
    expect(lane!.status).toBe("active");
    expect(lane!.phase).toBe("implementation");
    expect(lane!.sessionId).toBe("sess-001");
  });
});

describe("sessionClose", () => {
  it("updates lane status to completed", async () => {
    await sessionOpen({
      root: tmpDir,
      laneKey: "feature-y",
      phase: "correction",
      sessionId: "sess-002",
    });
    await sessionClose({
      root: tmpDir,
      laneKey: "feature-y",
      status: "completed",
    });

    const sessions = await loadSessions(tmpDir);
    const lane = sessions.lanes.find((l) => l.laneKey === "feature-y");
    expect(lane).toBeDefined();
    expect(lane!.status).toBe("completed");
  });

  it("missing laneKey → error", async () => {
    await expect(
      sessionClose({
        root: tmpDir,
        laneKey: "nonexistent",
        status: "completed",
      })
    ).rejects.toThrow("Lane not found: nonexistent");
  });
});

describe("checkSessions", () => {
  it("duplicate laneKey → error", () => {
    const sessions: ExecutionSession = {
      lanes: [
        {
          laneKey: "dup",
          phase: "implementation",
          sessionId: "s1",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
        {
          laneKey: "dup",
          phase: "correction",
          sessionId: "s2",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
      ],
    };
    const result = checkSessions(sessions);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Duplicate laneKey");
  });

  it("reused sessionId → error", () => {
    const sessions: ExecutionSession = {
      lanes: [
        {
          laneKey: "lane-a",
          phase: "implementation",
          sessionId: "same-sess",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
        {
          laneKey: "lane-b",
          phase: "correction",
          sessionId: "same-sess",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
      ],
    };
    const result = checkSessions(sessions);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Reused sessionId");
  });

  it("active lanes → error", () => {
    const sessions: ExecutionSession = {
      lanes: [
        {
          laneKey: "active-lane",
          phase: "implementation",
          sessionId: "s1",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
      ],
    };
    const result = checkSessions(sessions);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Active lanes at readiness");
  });

  it("no implementation lane → error", () => {
    const sessions: ExecutionSession = {
      lanes: [
        {
          laneKey: "only-correction",
          phase: "correction",
          sessionId: "s1",
          status: "completed",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
      ],
    };
    const result = checkSessions(sessions);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("No completed implementation lane");
  });
});

describe("getActiveSessionSummary", () => {
  it("no active lanes → N/A", () => {
    const sessions: ExecutionSession = {
      lanes: [
        {
          laneKey: "done-lane",
          phase: "implementation",
          sessionId: "s1",
          status: "completed",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
      ],
    };
    expect(getActiveSessionSummary(sessions)).toBe("N/A");
  });

  it("2 active → lane1 (implementation), lane2 (correction)", () => {
    const sessions: ExecutionSession = {
      lanes: [
        {
          laneKey: "lane1",
          phase: "implementation",
          sessionId: "s1",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
        {
          laneKey: "lane2",
          phase: "correction",
          sessionId: "s2",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
      ],
    };
    expect(getActiveSessionSummary(sessions)).toBe("lane1 (implementation), lane2 (correction)");
  });
});

describe("getSessionLanesSummary", () => {
  it("empty → N/A", () => {
    const sessions: ExecutionSession = { lanes: [] };
    expect(getSessionLanesSummary(sessions)).toBe("N/A");
  });

  it("mixed phases → implementation: 2, correction: 1", () => {
    const sessions: ExecutionSession = {
      lanes: [
        {
          laneKey: "a",
          phase: "implementation",
          sessionId: "s1",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
        {
          laneKey: "b",
          phase: "implementation",
          sessionId: "s2",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
        {
          laneKey: "c",
          phase: "correction",
          sessionId: "s3",
          status: "active",
          continuations: [],
          filesChanged: [],
          commandsRun: [],
        },
      ],
    };
    expect(getSessionLanesSummary(sessions)).toBe("implementation: 2, correction: 1");
  });
});
