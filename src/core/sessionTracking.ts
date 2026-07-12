import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./paths.js";
import { ExecutionSession, ExecutionSessionSchema, SessionLane } from "../schemas/session.js";

export interface SessionCheck {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function loadSessions(root: string): Promise<ExecutionSession> {
  const sessionPath = path.join(root, ".ai/memory-build/latest/execution-sessions.json");
  if (!existsSync(sessionPath)) {
    return { lanes: [] };
  }
  const content = await readFile(sessionPath, "utf8");
  return ExecutionSessionSchema.parse(JSON.parse(content));
}

async function saveSessions(root: string, sessions: ExecutionSession): Promise<void> {
  const sessionPath = path.join(root, ".ai/memory-build/latest/execution-sessions.json");
  await mkdir(path.dirname(sessionPath), { recursive: true });
  const temp = sessionPath + ".tmp";
  await writeFile(temp, JSON.stringify(sessions, null, 2), "utf8");
  await rename(temp, sessionPath);
}

export async function sessionOpen(options: {
  root?: string;
  laneKey: string;
  phase: string;
  sessionId: string;
  planTaskId?: string;
}): Promise<void> {
  const root = resolveRoot(options);
  const sessions = await loadSessions(root);

  const newLane: SessionLane = {
    laneKey: options.laneKey,
    phase: options.phase as any,
    sessionId: options.sessionId,
    planTaskId: options.planTaskId,
    status: "active",
    continuations: [],
    filesChanged: [],
    commandsRun: [],
  };

  sessions.lanes.push(newLane);
  await saveSessions(root, sessions);
}

export async function sessionClose(options: {
  root?: string;
  laneKey: string;
  status: "completed" | "failed";
}): Promise<void> {
  const root = resolveRoot(options);
  const sessions = await loadSessions(root);

  const lane = sessions.lanes.find((l) => l.laneKey === options.laneKey);
  if (!lane) {
    throw new Error(`Lane not found: ${options.laneKey}`);
  }

  lane.status = options.status;
  await saveSessions(root, sessions);
}

export function checkSessions(sessions: ExecutionSession): SessionCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  // No duplicate laneKey
  const laneKeys = sessions.lanes.map((l) => l.laneKey);
  const duplicates = laneKeys.filter((key, idx) => laneKeys.indexOf(key) !== idx);
  if (duplicates.length > 0) {
    errors.push(`Duplicate laneKey: ${[...new Set(duplicates)].join(", ")}`);
  }

  // No reused sessionId across lanes
  const sessionIds = sessions.lanes.map((l) => l.sessionId);
  const reused = sessionIds.filter((id, idx) => sessionIds.indexOf(id) !== idx);
  if (reused.length > 0) {
    errors.push(`Reused sessionId across lanes: ${[...new Set(reused)].join(", ")}`);
  }

  // No active lanes at readiness
  const active = sessions.lanes.filter((l) => l.status === "active");
  if (active.length > 0) {
    errors.push(`Active lanes at readiness: ${active.map((l) => l.laneKey).join(", ")}`);
  }

  // At least one completed implementation lane
  const implLanes = sessions.lanes.filter((l) => l.phase === "implementation" && l.status === "completed");
  if (implLanes.length === 0 && sessions.lanes.length > 0) {
    errors.push("No completed implementation lane");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getActiveSessionSummary(sessions: ExecutionSession): string {
  const active = sessions.lanes.filter((l) => l.status === "active");
  if (active.length === 0) return "N/A";
  return active.map((l) => `${l.laneKey} (${l.phase})`).join(", ");
}

export function getSessionLanesSummary(sessions: ExecutionSession): string {
  if (sessions.lanes.length === 0) return "N/A";
  const byPhase: Record<string, number> = {};
  for (const lane of sessions.lanes) {
    byPhase[lane.phase] = (byPhase[lane.phase] || 0) + 1;
  }
  return Object.entries(byPhase).map(([phase, count]) => `${phase}: ${count}`).join(", ");
}
