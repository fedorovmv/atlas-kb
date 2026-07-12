import { sessionOpen, sessionClose, loadSessions, checkSessions } from "../core/sessionTracking.js";

export async function sessionOpenCommand(options: {
  root?: string;
  laneKey: string;
  phase: string;
  sessionId: string;
  planTaskId?: string;
  json?: boolean;
}): Promise<void> {
  await sessionOpen({
    root: options.root,
    laneKey: options.laneKey,
    phase: options.phase,
    sessionId: options.sessionId,
    planTaskId: options.planTaskId,
  });

  if (options.json) {
    console.log(JSON.stringify({ opened: options.laneKey }, null, 2));
  } else {
    console.log(`Session opened: ${options.laneKey} (${options.phase})`);
  }
}

export async function sessionCloseCommand(options: {
  root?: string;
  laneKey: string;
  status: string;
  json?: boolean;
}): Promise<void> {
  await sessionClose({
    root: options.root,
    laneKey: options.laneKey,
    status: options.status as "completed" | "failed",
  });

  if (options.json) {
    console.log(JSON.stringify({ closed: options.laneKey, status: options.status }, null, 2));
  } else {
    console.log(`Session closed: ${options.laneKey} (${options.status})`);
  }
}
