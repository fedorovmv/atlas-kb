import {
  SpecialistAttempt, SpecialistAttemptSchema,
  GENERIC_AGENT_NAMES,
} from "../schemas/dispatch.js";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const ATTEMPTS_PATH = ".ai/memory-build/latest/specialist-attempts.jsonl";

/**
 * Записывает dispatch attempt в JSONL.
 */
export async function recordDispatchAttempt(
  attempt: Omit<SpecialistAttempt, "attemptId" | "timestamp">,
  options?: { root?: string }
): Promise<string> {
  const root = options?.root ?? process.cwd();
  const timestamp = new Date().toISOString();
  const content = { ...attempt, timestamp };
  const raw = JSON.stringify(content);
  const attemptId = createHash("sha256").update(raw + timestamp).digest("hex").slice(0, 16);

  const record = { ...content, attemptId, timestamp };
  const line = JSON.stringify(record) + "\n";

  const attemptsPath = path.join(root, ATTEMPTS_PATH);
  await fs.mkdir(path.dirname(attemptsPath), { recursive: true });
  await fs.appendFile(attemptsPath, line, "utf8");

  return attemptId;
}

/**
 * Детектирует impersonation в attempt.
 */
export function detectImpersonation(attempt: SpecialistAttempt): {
  isImpersonation: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const textToCheck = [attempt.notes, attempt.description]
    .filter(Boolean)
    .join(" ");

  // Regex patterns (из v3)
  const impersonationPatterns = [
    /ты\s—\s/i, /you\s+are\s+/i, /impersonat/i,
    /role\s+impersonation/i, /explore\s+task/i, /general\s+task/i,
  ];

  for (const pattern of impersonationPatterns) {
    if (pattern.test(textToCheck)) {
      reasons.push(`impersonation pattern matched: ${pattern.source}`);
    }
  }

  // Generic agent name check
  if (GENERIC_AGENT_NAMES.has(attempt.actualAgent)) {
    reasons.push(`generic agent name "${attempt.actualAgent}" cannot be specialist`);
  }

  // Tool must be "task"
  if (attempt.tool !== "task") {
    reasons.push(`tool must be "task", got "${attempt.tool}"`);
  }

  return { isImpersonation: reasons.length > 0, reasons };
}

/**
 * Advisory проверка dispatch: загружает attempts, проверяет impersonation, возвращает warnings.
 * НЕ возвращает errors — soft advisory (0.2 Решение 1).
 */
export async function checkDispatchAdvisory(
  options?: { root?: string }
): Promise<{ warnings: string[]; attemptsChecked: number }> {
  const root = options?.root ?? process.cwd();
  const attemptsPath = path.join(root, ATTEMPTS_PATH);

  let content: string;
  try {
    content = await fs.readFile(attemptsPath, "utf8");
  } catch {
    return { warnings: [], attemptsChecked: 0 };
  }

  const lines = content.split("\n").filter((l) => l.trim());
  const warnings: string[] = [];

  for (const line of lines) {
    try {
      const raw = JSON.parse(line);
      const attempt = SpecialistAttemptSchema.parse(raw);
      const result = detectImpersonation(attempt);
      if (result.isImpersonation) {
        for (const reason of result.reasons) {
          warnings.push(`dispatch[attempt=${attempt.attemptId}]: ${reason}`);
        }
      }
    } catch {
      warnings.push(`dispatch: failed to parse attempt line: ${line.slice(0, 80)}...`);
    }
  }

  return { warnings, attemptsChecked: lines.length };
}
