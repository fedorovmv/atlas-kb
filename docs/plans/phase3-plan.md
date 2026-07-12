# Phase 3 Implementation Plan: Workflow orchestration, git hooks, CI, OpenSpec integration

> Brief: `docs/plans/phase3-brief.md` | Spec: `docs/specs/GAP_CLOSURE_SPEC.md` §3 Domains G, H
> Base: Phase 2 complete (385 tests, v0.6.0) | Target: v0.7.0

## Execution state

Base commit: Phase 2 complete (v0.6.0)
Final: v0.7.0, 456 tests, build clean.
Baseline: 385 tests → 456 tests, build clean.

| Lane key | Epic | Status | Session | Dispatch |
|---|---|---|---|---|
| implementation/G1-workflow-modes | G1 | ✅ COMPLETE | fix-7 | FRESH |
| implementation/G2-session-tracking | G2 | ✅ COMPLETE | fix-1 | FRESH |
| implementation/G3-route-integration | G3 | ✅ COMPLETE | fix-8 (orchestrator) | FRESH |
| implementation/G4-model-routing | G4 | ✅ COMPLETE | fix-2 | FRESH |
| implementation/H1H2-git-hooks-ci | H1+H2 | ✅ COMPLETE | fix-3 | FRESH |
| implementation/H3-openspec | H3 | ✅ COMPLETE | fix-4 | FRESH |
| implementation/integration-debt | DEBT | ✅ COMPLETE | fix-6 | FRESH |
| integration-verification | VERIFY | ✅ COMPLETE | orchestrator | — |

**Phase 3 COMPLETE. v0.7.0. 456 tests. All 7 epics + integration debt.**

Execution order (respecting file-write conflicts):

**File conflict strategy:**
- `src/cli.ts` — touched by G1, G2, G4, H3. Assign to G1 lane. Other lanes export command handlers only, G1 adds all command registrations in wave 2.
- `src/index.ts` — touched by G1, G2, G4. Assign to G1 lane (wave 2).
- `src/commands/init.ts` — touched by H1, H2. Assign to H1 lane, H2 exports init logic as functions that H1 calls.
- `src/scaffold/templates.ts` — touched by H1, H2. Assign to H1 lane.
- `src/core/compaction.ts` — touched by G2 only. No conflict.
- `src/core/overview.ts` — touched by G2 (session data), G3 (route reasons). G3 is wave 2, after G2 completes. No conflict.

**Wave 1 (parallel, 6 independent lanes):**
1. G2 (session tracking core + commands) — creates schemas/session.ts, core/sessionTracking.ts, commands/session.ts, modifies compaction.ts and overview.ts
2. G4 (model routing) — creates schemas/modelRouting.ts, core/modelRouting.ts, commands/profile.ts, modifies templates/config/model-routing.yaml
3. H1 (git hooks + init updates) — creates templates/githooks/, modifies commands/init.ts and templates.ts
4. H2 (CI integration) — creates templates/.github/workflows/memory-bank.yml, exports init logic for H1
5. H3 (OpenSpec optional) — creates commands/openspec.ts
6. integration-debt (OpenCode tools) — modifies templates/tools/memory.ts

**Wave 2 (depends on G1):**
1. G1 (workflow modes + route command) — creates schemas/workflow.ts, core/changeSurface.ts, core/routeWorkflow.ts, commands/route.ts. Adds ALL cli.ts registrations for G1/G2/G4/H3. Updates index.ts for all new exports.
2. G3 (route integration) — modifies overview.ts to use route manifest

**Wave 3:**
1. Integration verification — full test suite, version bump 0.6.0 → 0.7.0, CHANGELOG

---

## Task 1: G2 — Session isolation tracking

### Outcome
Track execution lanes (implementation/correction/review) with session isolation, duplicate detection, and continuation validation. Write sessions to `.ai/memory-build/latest/execution-sessions.json`. Replace hard-coded "N/A" placeholders in compaction.ts and overview.ts with real session data.

### Files
- New: `src/schemas/session.ts`
- New: `src/core/sessionTracking.ts`
- New: `src/commands/session.ts`
- Modify: `src/core/compaction.ts` (replace "Active lane N/A" with session data)
- Modify: `src/core/overview.ts` (replace "Session lanes N/A" with session data)
- New: `test/sessionTracking.test.ts`
- Modify: `test/cli.test.ts`

### Implementation steps

1. Create `src/schemas/session.ts`:
   ```typescript
   import { z } from "zod";

   export const SessionPhaseSchema = z.enum([
     "implementation",
     "correction",
     "review:spec",
     "review:plan",
     "review:code",
   ]);

   export const ContinuationReasonSchema = z.enum([
     "interrupted-response",
     "unfinished-tool-sequence",
     "focused-test-failure",
     "immediate-local-correction",
   ]);

   export const SessionLaneSchema = z.object({
     laneKey: z.string(),
     phase: SessionPhaseSchema,
     sessionId: z.string(),
     planTaskId: z.string().optional(),
     status: z.enum(["active", "completed", "failed"]),
     continuations: z.array(z.object({
       reason: ContinuationReasonSchema,
       sessionId: z.string(),
     })),
     filesChanged: z.array(z.string()),
     commandsRun: z.array(z.string()),
   });

   export const ExecutionSessionSchema = z.object({
     lanes: z.array(SessionLaneSchema),
   });

   export type SessionPhase = z.infer<typeof SessionPhaseSchema>;
   export type ContinuationReason = z.infer<typeof ContinuationReasonSchema>;
   export type SessionLane = z.infer<typeof SessionLaneSchema>;
   export type ExecutionSession = z.infer<typeof ExecutionSessionSchema>;
   ```

2. Create `src/core/sessionTracking.ts`:
   ```typescript
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
       warnings.push(`Active lanes at readiness: ${active.map((l) => l.laneKey).join(", ")}`);
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
   ```

3. Create `src/commands/session.ts`:
   ```typescript
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
   ```

4. Modify `src/core/compaction.ts` — replace hard-coded "Active lane N/A":
   ```typescript
   // Add import at top:
   import { loadSessions, getActiveSessionSummary } from "./sessionTracking.js";
   
   // Replace line 33:
   const sessions = await loadSessions(root);
   const activeLane = getActiveSessionSummary(sessions);
   sections.push(`## Active lane\n${activeLane}`);
   ```

5. Modify `src/core/overview.ts` — replace hard-coded "Session lanes N/A":
   ```typescript
   // Add import at top:
   import { loadSessions, getSessionLanesSummary } from "./sessionTracking.js";
   
   // Replace line 46:
   const sessions = await loadSessions(root);
   const sessionSummary = getSessionLanesSummary(sessions);
   sections.push(`## Session lanes\n${sessionSummary}`);
   ```

### Tests

Create `test/sessionTracking.test.ts`:
- `sessionOpen`: creates new lane with status=active
- `sessionClose`: updates lane status to completed
- `sessionClose`: missing laneKey → error
- `checkSessions`: duplicate laneKey → error
- `checkSessions`: reused sessionId → error
- `checkSessions`: active lanes → warning
- `checkSessions`: no implementation lane → error
- `getActiveSessionSummary`: no active lanes → "N/A"
- `getActiveSessionSummary`: 2 active → "lane1 (implementation), lane2 (correction)"
- `getSessionLanesSummary`: empty → "N/A"
- `getSessionLanesSummary`: mixed phases → "implementation: 2, correction: 1"

Extend `test/cli.test.ts`:
- CLI session-open: --json outputs valid JSON
- CLI session-close: --json outputs valid JSON

### Completion evidence
- `npm run build && npm test` pass
- `execution-sessions.json` created when session-open runs
- compaction.ts and overview.ts show real session data instead of "N/A"

---


## Task 2: G4 — Model routing profiles

### Outcome
Add 3 profiles (quality/balanced/economy) with model-role assignments, activeProfile switching, CLI `profile` command. Extend model-routing.yaml template with profiles structure.

### Files
- New: `src/schemas/modelRouting.ts`
- New: `src/core/modelRouting.ts`
- New: `src/commands/profile.ts`
- Modify: `src/scaffold/templates/config/model-routing.yaml`
- New: `test/modelRouting.test.ts`
- Modify: `test/cli.test.ts`

### Implementation steps

1. Create `src/schemas/modelRouting.ts`:
   ```typescript
   import { z } from "zod";

   export const MODEL_ROLES = {
     orchestrator: "orchestrator",
     repositoryDiscovery: "memory-extractor",
     architectureSynthesis: "memory-analyst",
     implementation: "memory-coder",
     semanticReview: "memory-reviewer",
   } as const;

   export const ModelProfileSchema = z.record(z.string(), z.string()); // role → model

   export const ModelRoutingSchema = z.object({
     profiles: z.object({
       quality: ModelProfileSchema,
       balanced: ModelProfileSchema,
       economy: ModelProfileSchema,
     }),
     activeProfile: z.enum(["quality", "balanced", "economy"]).default("balanced"),
     routing: z.record(z.string(), z.string()), // task → role
   });

   export type ModelProfile = z.infer<typeof ModelProfileSchema>;
   export type ModelRouting = z.infer<typeof ModelRoutingSchema>;
   ```

2. Create `src/core/modelRouting.ts`:
   ```typescript
    import { readFile, writeFile, rename } from "node:fs/promises";
   import { existsSync } from "node:fs";
   import path from "node:path";
   import * as yaml from "js-yaml";
   import { resolveRoot } from "./paths.js";
   import { ModelRouting, ModelRoutingSchema } from "../schemas/modelRouting.js";

   export async function loadModelRouting(root: string): Promise<ModelRouting | null> {
     const configPath = path.join(root, ".ai/memory-tool/config/model-routing.yaml");
     if (!existsSync(configPath)) {
       return null;
     }
     const content = await readFile(configPath, "utf8");
     const parsed = yaml.load(content);
     return ModelRoutingSchema.parse(parsed);
   }

   export async function switchProfile(options: {
     root?: string;
     profile: "quality" | "balanced" | "economy";
   }): Promise<void> {
     const root = resolveRoot(options);
     const configPath = path.join(root, ".ai/memory-tool/config/model-routing.yaml");
     
     if (!existsSync(configPath)) {
       throw new Error("model-routing.yaml not found. Run: repo-memory init");
     }
     
      const content = await readFile(configPath, "utf8");
      let routing = ModelRoutingSchema.parse(yaml.load(content));
      routing.activeProfile = options.profile;
      routing = ModelRoutingSchema.parse(routing); // re-validate after change
      
      const updated = yaml.dump(routing, { lineWidth: -1 });
      const temp = configPath + ".tmp";
      await writeFile(temp, updated, "utf8");
      await rename(temp, configPath);
   }

   export async function getActiveProfile(root: string): Promise<string> {
     const routing = await loadModelRouting(root);
     return routing?.activeProfile ?? "balanced";
   }
   ```

3. Create `src/commands/profile.ts`:
   ```typescript
   import { switchProfile, getActiveProfile } from "../core/modelRouting.js";
   import { resolveRoot } from "../core/paths.js";

   export async function profileCommand(options: {
     root?: string;
     profile?: string;
     json?: boolean;
   }): Promise<void> {
     const root = resolveRoot(options);
     
     if (!options.profile) {
       // Show current profile
       const current = await getActiveProfile(root);
       if (options.json) {
         console.log(JSON.stringify({ activeProfile: current }, null, 2));
       } else {
         console.log(`Active profile: ${current}`);
       }
       return;
     }
     
     if (!["quality", "balanced", "economy"].includes(options.profile)) {
       throw new Error(`Invalid profile: ${options.profile}. Valid: quality, balanced, economy`);
     }
     
     await switchProfile({
       root,
       profile: options.profile as "quality" | "balanced" | "economy",
     });
     
     if (options.json) {
       console.log(JSON.stringify({ activeProfile: options.profile }, null, 2));
     } else {
       console.log(`Profile switched to: ${options.profile}`);
     }
   }
   ```

4. Modify `src/scaffold/templates/config/model-routing.yaml`:
   ```yaml
   profiles:
     quality:
       orchestrator: claude-opus-4
       memory-extractor: claude-opus-4
       memory-analyst: claude-opus-4
       memory-coder: claude-opus-4
       memory-reviewer: claude-opus-4
     balanced:
       orchestrator: claude-sonnet-4
       memory-extractor: claude-sonnet-4
       memory-analyst: claude-sonnet-4
       memory-coder: claude-sonnet-4
       memory-reviewer: claude-sonnet-4
     economy:
       orchestrator: claude-haiku-4
       memory-extractor: claude-haiku-4
       memory-analyst: claude-sonnet-4
       memory-coder: claude-sonnet-4
       memory-reviewer: claude-haiku-4

   activeProfile: balanced

   routing:
     discovery: memory-extractor
     analysis: memory-analyst
     implementation: memory-coder
     review: memory-reviewer
     orchestration: orchestrator
   ```

### Tests

Create `test/modelRouting.test.ts`:
- `loadModelRouting`: parses model-routing.yaml with profiles
- `loadModelRouting`: missing file → null
- `switchProfile`: updates activeProfile in YAML
- `switchProfile`: preserves profiles and routing sections
- `getActiveProfile`: returns activeProfile from config
- `getActiveProfile`: missing config → "balanced" default
- ModelRoutingSchema: valid config → parse success
- ModelRoutingSchema: missing profiles → parse error

Extend `test/cli.test.ts`:
- CLI profile: no args → shows current profile
- CLI profile quality: switches to quality
- CLI profile: --json outputs valid JSON
- CLI profile invalid: error

### Completion evidence
- `npm run build && npm test` pass
- `repo-memory profile` shows active profile
- `repo-memory profile quality` updates model-routing.yaml activeProfile field

---

## Task 3: H1 — Git hooks

### Outcome
4 git hook templates (pre-commit, pre-push, post-checkout, post-merge) with `init --install-hooks` flag. Hooks use `npx repo-memory` for portability.

### Files
- New: `src/scaffold/templates/githooks/pre-commit`
- New: `src/scaffold/templates/githooks/pre-push`
- New: `src/scaffold/templates/githooks/post-checkout`
- New: `src/scaffold/templates/githooks/post-merge`
- Modify: `src/commands/init.ts`
- Modify: `src/scaffold/templates.ts`
- New: `test/gitHooks.test.ts`

### Implementation steps

1. Create hook templates (4 files in `src/scaffold/templates/githooks/`):

`pre-commit`:
```bash
#!/bin/sh
# Memory Bank pre-commit validation
if [ -f "./node_modules/.bin/repo-memory" ]; then
  MEMORY_CMD="./node_modules/.bin/repo-memory"
else
  MEMORY_CMD="npx repo-memory"
fi
echo "Running memory bank validation..."
$MEMORY_CMD validate --root .
if [ $? -ne 0 ]; then
  echo "❌ Memory validation failed. Fix errors or use --no-verify to skip."
  exit 1
fi
echo "✅ Memory validation passed"
exit 0
```

`pre-push`:
```bash
#!/bin/sh
# Memory Bank pre-push validation (strict)
if [ -f "./node_modules/.bin/repo-memory" ]; then
  MEMORY_CMD="./node_modules/.bin/repo-memory"
else
  MEMORY_CMD="npx repo-memory"
fi
echo "Running strict memory bank validation..."
$MEMORY_CMD validate --root . --strict-warnings
if [ $? -ne 0 ]; then
  echo "❌ Strict validation failed. Fix warnings or use --no-verify to skip."
  exit 1
fi
echo "✅ Strict validation passed"
exit 0
```

`post-checkout`:
```bash
#!/bin/sh
# Memory Bank search index rebuild (non-blocking)
if [ -f "./node_modules/.bin/repo-memory" ]; then
  MEMORY_CMD="./node_modules/.bin/repo-memory"
else
  MEMORY_CMD="npx repo-memory"
fi
echo "Rebuilding memory search index..."
$MEMORY_CMD artifacts-search "." --root . > /dev/null 2>&1 &
exit 0
```

`post-merge`:
```bash
#!/bin/sh
# Memory Bank search index rebuild (non-blocking)
if [ -f "./node_modules/.bin/repo-memory" ]; then
  MEMORY_CMD="./node_modules/.bin/repo-memory"
else
  MEMORY_CMD="npx repo-memory"
fi
echo "Rebuilding memory search index..."
$MEMORY_CMD artifacts-search "." --root . > /dev/null 2>&1 &
exit 0
```

2. Modify `src/scaffold/templates.ts`:
   ```typescript
   export function getHookTemplates(): ScaffoldFile[] {
     return [
       { path: ".git/hooks/pre-commit", content: loadTemplate("githooks/pre-commit") },
       { path: ".git/hooks/pre-push", content: loadTemplate("githooks/pre-push") },
       { path: ".git/hooks/post-checkout", content: loadTemplate("githooks/post-checkout") },
       { path: ".git/hooks/post-merge", content: loadTemplate("githooks/post-merge") },
     ];
   }

   export function getCiTemplate(): ScaffoldFile {
     return {
       path: ".github/workflows/memory-bank.yml",
       content: loadTemplate(".github/workflows/memory-bank.yml"),
     };
   }
   ```

3. Modify `src/commands/init.ts` — add `installHooks` and `installCi` options:
   ```typescript
   import { getHookTemplates, getCiTemplate } from "../scaffold/templates.js";
   import { chmod } from "node:fs/promises";

   export async function initMemory(options: {
     root?: string;
     force?: boolean;
     dryRun?: boolean;
     installHooks?: boolean;
     installCi?: boolean;
   } = {}) {
     const root = path.resolve(options.root ?? process.cwd());
     const written: string[] = [];
     const skipped: string[] = [];

     // Existing scaffold logic
     for (const file of scaffoldFiles) {
       const target = path.join(root, file.path);
       if (existsSync(target) && !options.force) {
         skipped.push(file.path);
         continue;
       }
       if (!options.dryRun) {
         await mkdir(path.dirname(target), { recursive: true });
         await writeFile(target, file.content, "utf8");
       }
       written.push(file.path);
     }

     // Install git hooks
     if (options.installHooks) {
       const gitDir = path.join(root, ".git");
       if (!existsSync(gitDir)) {
         console.warn("⚠️  No .git directory found. Skipping hook installation.");
       } else {
         const hookTemplates = getHookTemplates();
         for (const hook of hookTemplates) {
           const target = path.join(root, hook.path);
           if (!options.dryRun) {
             await mkdir(path.dirname(target), { recursive: true });
             await writeFile(target, hook.content, "utf8");
             await chmod(target, 0o755); // Make executable
           }
           written.push(hook.path);
         }
       }
     }

     // Install CI
     if (options.installCi) {
       const ciTemplate = getCiTemplate();
       const target = path.join(root, ciTemplate.path);
       if (!options.dryRun) {
         await mkdir(path.dirname(target), { recursive: true });
         await writeFile(target, ciTemplate.content, "utf8");
       }
       written.push(ciTemplate.path);
     }

     // Existing contract logic (unchanged)
     const memoryRoot = path.join(root, ".ai", "memory");
     const contractPath = path.join(memoryRoot, "memory-contract.json");
     const contract = {
       version: 2,
       language: "ru",
       requiredTopLevel: [
         "MEMORY.md", "PROJECT.md", "MODULES.md", "ARCHITECTURE.md",
         "TASK_ROUTING.md", "FLOWS.md", "TESTING.md", "OPS.md",
         "GOTCHAS.md", "DECISIONS.md",
       ],
       requiredSubdirs: ["modules", "flows", "decisions", "architecture"],
       dispositions: ["extracted", "rationale-only", "superseded", "historical-only", "rejected", "deferred", "unknown"],
       specialistPhases: ["discovery-semantic", "code-evidence", "rationale-extraction", "quality-review"],
     };
     if (!options.dryRun && (!existsSync(contractPath) || options.force)) {
       await mkdir(memoryRoot, { recursive: true });
       await writeFile(contractPath, JSON.stringify(contract, null, 2), "utf8");
     }

     // Output
     const packageJsonPath = path.join(root, "package.json");
     const packageHint = existsSync(packageJsonPath)
       ? "Add or keep a root script like: \"memory\": \"tsx .ai/memory-tool/src/cli.ts\" if you vendor this tool into the repo."
       : "Create package.json or run this kit from its own directory.";

     console.log(`# Memory scaffold ${options.dryRun ? "plan" : "created"}`);
     console.log(`\nRoot: ${root}`);
     if (written.length) {
       console.log("\n## Written");
       for (const item of written) console.log(`- ${item}`);
     }
     if (skipped.length) {
       console.log("\n## Skipped existing files");
       for (const item of skipped) console.log(`- ${item}`);
     }
     console.log(`\n## Next steps`);
     console.log(`- ${packageHint}`);
     console.log(`- Run: npm run memory -- validate`);
     console.log(`- Run: npm run memory -- context "изменить Agent & Tool Registry"`);
   }
   ```

### Tests

Create `test/gitHooks.test.ts`:
- Hook templates exist in templates/githooks/
- pre-commit contains "repo-memory validate"
- pre-push contains "--strict-warnings"
- post-checkout is non-blocking (background &)
- post-merge is non-blocking (background &)
- init --install-hooks: copies to .git/hooks/
- init --install-hooks: chmod 0o755 (executable)
- init --install-hooks: no .git → warning, no error

### Completion evidence
- `npm run build && npm test` pass
- `repo-memory init --install-hooks` creates 4 executable hooks

---

## Task 4: H2 — CI integration

### Outcome
GitHub Actions workflow template for memory bank validation. Installed via `init --install-ci`.

### Files
- New: `src/scaffold/templates/.github/workflows/memory-bank.yml`
- Modify: `src/scaffold/templates.ts` (getCiTemplate — already added in H1)
- New: `test/ciTemplate.test.ts`

### Implementation steps

1. Create `src/scaffold/templates/.github/workflows/memory-bank.yml`:
   ```yaml
   name: Memory Bank Validation

   on:
     pull_request:
       branches: [main, master, develop]
     workflow_dispatch:

   jobs:
     validate:
       runs-on: ubuntu-latest
       
       steps:
         - name: Checkout repository
           uses: actions/checkout@v4
         
         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '20'
         
         - name: Install dependencies
           run: npm ci
         
         - name: Validate memory bank
           run: npx repo-memory validate --root . --require-source-coverage --json
         
         - name: Upload validation results
           if: always()
           uses: actions/upload-artifact@v4
           with:
             name: memory-validation-results
             path: .ai/memory-build/latest/validation-results.json
             if-no-files-found: ignore
   ```

2. `getCiTemplate()` export added in H1 templates.ts (already covered in Task 3 step 2).

3. init.ts `--install-ci` logic added in H1 (already covered in Task 3 step 3).

### Tests

Create `test/ciTemplate.test.ts`:
- CI template exists at templates/.github/workflows/memory-bank.yml
- Valid YAML (parse with js-yaml)
- Contains "repo-memory validate"
- Contains "--require-source-coverage"
- Runs on pull_request
- Uses ubuntu-latest
- Uses Node 20

### Completion evidence
- `npm run build && npm test` pass
- `repo-memory init --install-ci` creates .github/workflows/memory-bank.yml
- Valid GitHub Actions YAML

---

## Task 5: H3 — OpenSpec integration (optional)

### Outcome
4 OpenSpec CLI commands with graceful degradation if `@fission-ai/openspec` not installed.

### Files
- New: `src/commands/openspec.ts`
- New: `test/openspec.test.ts`
- Modify: `test/cli.test.ts`

### Implementation steps

1. Create `src/commands/openspec.ts`:
   ```typescript
   import { execFile } from "node:child_process";
   import { promisify } from "node:util";

   const execFileAsync = promisify(execFile);

    async function checkOpenspecInstalled(): Promise<boolean> {
      // Try direct openspec CLI first, then npx fallback
      try {
        await execFileAsync("openspec", ["--version"]);
        return true;
      } catch {
        try {
          await execFileAsync("npx", ["@fission-ai/openspec", "--version"]);
          return true;
        } catch {
          return false;
        }
      }
    }

   async function runOpenspec(args: string[]): Promise<string> {
     const { stdout, stderr } = await execFileAsync("npx", ["@fission-ai/openspec", ...args], {
       maxBuffer: 1024 * 1024 * 4,
     });
     return stdout || stderr;
   }

   export async function openspecNewCommand(options: {
     root?: string;
     name?: string;
     json?: boolean;
   }): Promise<void> {
     if (!(await checkOpenspecInstalled())) {
       console.log("OpenSpec not installed. Install with: npm i @fission-ai/openspec");
       return;
     }
     
     const args = ["new"];
     if (options.name) args.push(options.name);
     if (options.json) args.push("--json");
     
     const output = await runOpenspec(args);
     console.log(output);
   }

   export async function openspecStatusCommand(options: {
     root?: string;
     json?: boolean;
   }): Promise<void> {
     if (!(await checkOpenspecInstalled())) {
       console.log("OpenSpec not installed. Install with: npm i @fission-ai/openspec");
       return;
     }
     
     const args = ["status"];
     if (options.json) args.push("--json");
     
     const output = await runOpenspec(args);
     console.log(output);
   }

   export async function openspecCheckCommand(options: {
     root?: string;
     json?: boolean;
   }): Promise<void> {
     if (!(await checkOpenspecInstalled())) {
       console.log("OpenSpec not installed. Install with: npm i @fission-ai/openspec");
       return;
     }
     
     const args = ["check"];
     if (options.json) args.push("--json");
     
     const output = await runOpenspec(args);
     console.log(output);
   }

   export async function openspecArchiveCommand(options: {
     root?: string;
     name: string;
     json?: boolean;
   }): Promise<void> {
     if (!(await checkOpenspecInstalled())) {
       console.log("OpenSpec not installed. Install with: npm i @fission-ai/openspec");
       return;
     }
     
     const args = ["archive", options.name];
     if (options.json) args.push("--json");
     
     const output = await runOpenspec(args);
     console.log(output);
   }
   ```

### Tests

Create `test/openspec.test.ts`:
- `checkOpenspecInstalled`: not installed → false (mock execFile throw)
- `checkOpenspecInstalled`: installed → true (mock success)
- `openspecNewCommand`: not installed → graceful message
- `openspecNewCommand`: installed → delegates to npx @fission-ai/openspec
- `openspecStatusCommand`: not installed → graceful message
- `openspecCheckCommand`: not installed → graceful message
- `openspecArchiveCommand`: not installed → graceful message

Extend `test/cli.test.ts`:
- CLI openspec-new: --json passed
- CLI openspec-status: delegates
- CLI openspec-check: delegates
- CLI openspec-archive: requires name

### Completion evidence
- `npm run build && npm test` pass
- `repo-memory openspec-status` without openspec → graceful message
- With openspec → delegates

---

## Task 6: Integration debt — OpenCode tools (3 missing)

### Outcome
Add legacyIngest, compact, artifactSearch tool wrappers. Brings count from 8→11.

### Files
- Modify: `src/scaffold/templates/tools/memory.ts`
- Modify: `test/cli.test.ts` (if tool tests exist)

### Implementation steps

1. Modify `src/scaffold/templates/tools/memory.ts` — append 3 tools:
   ```typescript
   export const legacyIngest = tool({
     description: "Run legacy document classification and ingestion pipeline.",
     args: {
       sources: tool.schema.array(tool.schema.string()).describe("Source paths to ingest"),
       batch: tool.schema.string().optional().describe("Batch name"),
     },
     async execute(args) {
       const sourceArgs = args.sources.flatMap((s) => [s]);
       const batchArgs = args.batch ? ["--batch", args.batch] : [];
       return runMemory(["legacy-ingest", ...sourceArgs, ...batchArgs, "--json"]);
     },
   });

   export const compact = tool({
     description: "Build a compact memory summary for bounded context (12KB max by default).",
     args: {
       root: tool.schema.string().optional().describe("Repository root path"),
       maxChars: tool.schema.number().optional().describe("Maximum characters (default 12000)"),
     },
     async execute(args) {
       const flags: string[] = [];
       if (args.root) flags.push("--root", args.root);
       if (args.maxChars) flags.push("--max-chars", String(args.maxChars));
       flags.push("--json");
       return runMemory(["compact", ...flags]);
     },
   });

   export const artifactSearch = tool({
     description: "Search artifact index with scoring (4 points title, 1 point haystack).",
     args: {
       query: tool.schema.string().describe("Search query"),
       limit: tool.schema.number().optional().describe("Result limit (default 8)"),
     },
     async execute(args) {
       const limitArgs = args.limit ? ["--limit", String(args.limit)] : [];
       return runMemory(["artifacts-search", args.query, ...limitArgs, "--json"]);
     },
   });
   ```

### Tests

Extend `test/cli.test.ts` or create tool-specific tests:
- legacyIngest: sources array → flattened args
- legacyIngest: batch option → --batch flag
- compact: maxChars → --max-chars flag
- artifactSearch: query + limit → correct args

### Completion evidence
- `npm run build && npm test` pass
- tools/memory.ts exports 11 tools
- Pattern matches existing runMemory() usage
- **Note**: Existing projects that have already run `init` must re-run `repo-memory init --force` to update `tools/memory.ts` with the 3 new tools. Document in CHANGELOG.

---

## Task 7: G1 — Adaptive workflow modes + route command + CLI integration

### Outcome
DIRECT/PLAN/FULL workflow routing with change surface analysis, priority chain escalation, route manifest output. Add ALL cli.ts command registrations for G1/G2/G4/H3. Update index.ts for all Phase 3 exports.

### Files
- New: `src/schemas/workflow.ts`
- New: `src/core/changeSurface.ts`
- New: `src/core/routeWorkflow.ts`
- New: `src/commands/route.ts`
- Modify: `src/cli.ts` (add route, session-open, session-close, profile, openspec-* commands)
- Modify: `src/index.ts` (export all Phase 3 modules)
- New: `test/workflow.test.ts`
- Modify: `test/cli.test.ts`

### Implementation steps

1. Create `src/schemas/workflow.ts`:
   ```typescript
   import { z } from "zod";

   export const WorkflowModeSchema = z.enum(["direct", "plan", "full"]);

   export const ChangeSurfaceSchema = z.object({
     changedFiles: z.array(z.string()),
     components: z.array(z.string()),
     risks: z.array(z.string()),
     type: z.string(), // bugfix, feature, refactor, etc.
     behaviorChange: z.boolean(),
   });

   export const WorkflowPolicySchema = z.object({
     modes: z.object({
       direct: z.object({
         maxComponents: z.number().default(1),
         maxChangedFiles: z.number().default(8),
         allowedTypes: z.array(z.string()),
         forbiddenRisks: z.array(z.string()),
       }),
       plan: z.object({
         maxComponents: z.number().default(2),
         forbiddenRisks: z.array(z.string()),
         fullTypes: z.array(z.string()),
       }),
       full: z.object({
         triggerRisks: z.array(z.string()),
         triggerDecisionDimensions: z.array(z.string()),
       }),
     }),
   });

   export const RouteResultSchema = z.object({
     mode: WorkflowModeSchema,
     reasons: z.array(z.string()),
     type: z.string(),
     risks: z.array(z.string()),
     behaviorChange: z.boolean(),
   });

   export type WorkflowMode = z.infer<typeof WorkflowModeSchema>;
   export type ChangeSurface = z.infer<typeof ChangeSurfaceSchema>;
   export type WorkflowPolicy = z.infer<typeof WorkflowPolicySchema>;
   export type RouteResult = z.infer<typeof RouteResultSchema>;
   ```

2. Create `src/core/changeSurface.ts`:
   ```typescript
   import { execFile } from "node:child_process";
   import { promisify } from "node:util";
   import path from "node:path";
   import { resolveRoot } from "./paths.js";
   import { ChangeSurface } from "../schemas/workflow.js";

   const execFileAsync = promisify(execFile);

   export async function analyzeChangeSurface(options: {
     root?: string;
     baseRef?: string;
   }): Promise<ChangeSurface> {
     const root = resolveRoot(options);
      const baseRef = options.baseRef ?? "HEAD~1";

      // Get changed files via git diff
      let changedFiles: string[] = [];
      try {
        const { stdout } = await execFileAsync("git", ["diff", "--name-only", baseRef], { cwd: root });
       changedFiles = stdout.trim().split("\n").filter(Boolean);
     } catch {
       // Not a git repo or no changes — empty surface
       changedFiles = [];
     }

     // Group by module/component (simplified: top-level directory)
     const components = new Set<string>();
     for (const file of changedFiles) {
       const parts = file.split("/");
       if (parts.length > 1) {
         components.add(parts[0]);
       }
     }

      // Heuristic risk detection
      // TODO(Phase 4): Replace heuristic risk detection with AST-based or config-driven rules.
      // Current string-includes approach is intentionally simple for Phase 3 MVP.
      const risks: string[] = [];
     for (const file of changedFiles) {
       if (file.includes("auth") || file.includes("security")) risks.push("security-boundary");
       if (file.includes("migration") || file.includes("schema")) risks.push("data-migration");
       if (file.includes("api") && file.includes("contract")) risks.push("api-contract-change");
       if (file.includes("distributed") || file.includes("consensus")) risks.push("distributed-consistency");
       if (file.includes("architecture")) risks.push("new-architecture");
     }

     // Heuristic type detection
     let type = "feature";
     const allText = changedFiles.join(" ").toLowerCase();
     if (allText.includes("fix") || allText.includes("bug")) type = "bugfix";
     if (allText.includes("refactor")) type = "refactor";
     if (allText.includes("test")) type = "test";
     if (allText.includes("doc")) type = "docs";
     if (allText.includes("chore")) type = "chore";

     // Behavior change heuristic: feature/bugfix = true, refactor/test/docs/chore = false
     const behaviorChange = ["feature", "bugfix"].includes(type);

     return {
       changedFiles,
       components: Array.from(components),
       risks: Array.from(new Set(risks)),
       type,
       behaviorChange,
     };
   }
   ```

3. Create `src/core/routeWorkflow.ts`:
   ```typescript
   import { ChangeSurface, WorkflowPolicy, RouteResult } from "../schemas/workflow.js";

   export const DEFAULT_POLICY: WorkflowPolicy = {
     modes: {
       direct: {
         maxComponents: 1,
         maxChangedFiles: 8,
         allowedTypes: ["bugfix", "refactor", "test", "docs", "chore"],
         forbiddenRisks: [
           "security-boundary", "data-migration", "api-contract-change",
           "distributed-consistency", "new-architecture", "deployment-change",
           "backward-incompatible", "performance-critical", "high-scale-impact",
           "auth-change", "encryption-change", "payment-flow", "audit-trail",
           "compliance-boundary", "multi-tenant-change", "feature-flag-removal",
           "cache-invalidation-strategy", "session-management", "rate-limiting",
         ],
       },
       plan: {
         maxComponents: 2,
         forbiddenRisks: ["new-architecture", "distributed-consistency", "security-boundary"],
         fullTypes: ["architecture"],
       },
       full: {
         triggerRisks: [
           "new-architecture", "distributed-consistency", "security-boundary",
           "data-migration", "deployment-change", "backward-incompatible",
           "multi-service-coordination", "state-machine-change", "consensus-protocol",
           "cross-region-replication",
         ],
         triggerDecisionDimensions: [
           "scalability", "consistency-model", "failure-handling", "observability",
           "security-model", "data-retention", "multi-tenancy", "api-versioning",
           "deployment-strategy", "disaster-recovery", "compliance", "performance-sla",
         ],
       },
     },
   };

    export function routeWorkflow(surface: ChangeSurface, policy: WorkflowPolicy = DEFAULT_POLICY): RouteResult {
      const reasons: string[] = [];

      // Priority chain: DIRECT → PLAN → FULL (spec-compliant order)

      // 1. Check DIRECT eligibility first
      if (surface.components.length <= policy.modes.direct.maxComponents &&
          surface.changedFiles.length <= policy.modes.direct.maxChangedFiles) {
        const forbidden = surface.risks.filter((r) => policy.modes.direct.forbiddenRisks.includes(r));
        if (forbidden.length === 0 && !(surface.type === "refactor" && surface.behaviorChange)) {
          reasons.push("Bounded change, low risk");
          return { mode: "direct", reasons, type: surface.type, risks: surface.risks, behaviorChange: surface.behaviorChange };
        }
        if (forbidden.length > 0) reasons.push(`DIRECT forbidden risks: ${forbidden.join(", ")}`);
        if (surface.type === "refactor" && surface.behaviorChange) reasons.push("Refactor with behavior change requires PLAN");
      } else {
        if (surface.components.length > policy.modes.direct.maxComponents)
          reasons.push(`Components exceed DIRECT limit: ${surface.components.length} > ${policy.modes.direct.maxComponents}`);
        if (surface.changedFiles.length > policy.modes.direct.maxChangedFiles)
          reasons.push(`Files exceed DIRECT limit: ${surface.changedFiles.length} > ${policy.modes.direct.maxChangedFiles}`);
      }

      // 2. Check PLAN eligibility
      if (surface.components.length <= policy.modes.plan.maxComponents) {
        const planForbidden = surface.risks.filter((r) => policy.modes.plan.forbiddenRisks.includes(r));
        if (planForbidden.length === 0 && !policy.modes.plan.fullTypes.includes(surface.type)) {
          reasons.push("Multi-component coordinated change");
          return { mode: "plan", reasons, type: surface.type, risks: surface.risks, behaviorChange: surface.behaviorChange };
        }
        if (planForbidden.length > 0) reasons.push(`PLAN forbidden risks: ${planForbidden.join(", ")}`);
        if (policy.modes.plan.fullTypes.includes(surface.type)) reasons.push(`Type requires FULL: ${surface.type}`);
      } else {
        reasons.push(`Components exceed PLAN limit: ${surface.components.length} > ${policy.modes.plan.maxComponents}`);
      }

      // 3. FULL fallback
      const trigger = surface.risks.find((r) => policy.modes.full.triggerRisks.includes(r));
      if (trigger) reasons.push(`Trigger risk detected: ${trigger}`);
      else reasons.push("DIRECT and PLAN ineligible");
      return { mode: "full", reasons, type: surface.type, risks: surface.risks, behaviorChange: surface.behaviorChange };
    }
   ```

4. Create `src/commands/route.ts`:
   ```typescript
   import { writeFile, mkdir } from "node:fs/promises";
   import path from "node:path";
   import { analyzeChangeSurface } from "../core/changeSurface.js";
   import { routeWorkflow } from "../core/routeWorkflow.js";
   import { resolveRoot } from "../core/paths.js";

   export async function routeCommand(options: {
     root?: string;
     baseRef?: string;
     json?: boolean;
   }): Promise<void> {
     const root = resolveRoot(options);
     
     const surface = await analyzeChangeSurface({
       root,
       baseRef: options.baseRef,
     });
     
     const result = routeWorkflow(surface);
     
     // Write route manifest
     const manifestPath = path.join(root, ".ai/memory-build/latest/route-manifest.json");
     await mkdir(path.dirname(manifestPath), { recursive: true });
     await writeFile(manifestPath, JSON.stringify({ surface, result }, null, 2), "utf8");
     
     if (options.json) {
       console.log(JSON.stringify(result, null, 2));
     } else {
       console.log(`Workflow mode: ${result.mode.toUpperCase()}`);
       console.log(`Type: ${result.type}`);
       console.log(`Components: ${surface.components.length}`);
       console.log(`Changed files: ${surface.changedFiles.length}`);
       console.log(`Risks: ${result.risks.join(", ") || "none"}`);
       console.log(`\nReasons:`);
       for (const reason of result.reasons) {
         console.log(`  - ${reason}`);
       }
     }
   }
   ```

5. Modify `src/cli.ts` — add ALL Phase 3 command registrations:
   ```typescript
   // Add imports at top
   import { routeCommand } from "./commands/route.js";
   import { sessionOpenCommand, sessionCloseCommand } from "./commands/session.js";
   import { profileCommand } from "./commands/profile.js";
   import { openspecNewCommand, openspecStatusCommand, openspecCheckCommand, openspecArchiveCommand } from "./commands/openspec.js";

   // Update version
   program.version("0.7.0")

   // Add route command
   program
     .command("route")
     .description("Analyze change surface and determine workflow mode")
      .option("--base-ref <ref>", "Base git ref for diff", "HEAD~1")
     .option("--json", "JSON output", false)
     .action(async (opts) => {
       const root = program.opts().root;
       await routeCommand({ root, baseRef: opts.baseRef, json: opts.json });
     });

   // Add session commands
   program
     .command("session-open")
     .description("Open a new execution session lane")
     .requiredOption("--lane-key <key>", "Lane key")
     .requiredOption("--phase <phase>", "Phase (implementation/correction/review:*)")
     .requiredOption("--session-id <id>", "Session ID")
     .option("--plan-task-id <id>", "Plan task ID")
     .option("--json", "JSON output", false)
     .action(async (opts) => {
       const root = program.opts().root;
       await sessionOpenCommand({ root, laneKey: opts.laneKey, phase: opts.phase, sessionId: opts.sessionId, planTaskId: opts.planTaskId, json: opts.json });
     });

   program
     .command("session-close")
     .description("Close an execution session lane")
     .requiredOption("--lane-key <key>", "Lane key")
     .requiredOption("--status <status>", "Status (completed/failed)")
     .option("--json", "JSON output", false)
     .action(async (opts) => {
       const root = program.opts().root;
       await sessionCloseCommand({ root, laneKey: opts.laneKey, status: opts.status, json: opts.json });
     });

   // Add profile command
   program
     .command("profile [profile]")
     .description("Show or switch model routing profile (quality/balanced/economy)")
     .option("--json", "JSON output", false)
     .action(async (profile, opts) => {
       const root = program.opts().root;
       await profileCommand({ root, profile, json: opts.json });
     });

   // Add OpenSpec commands
   program
     .command("openspec-new [name]")
     .description("Create new OpenSpec artifact")
     .option("--json", "JSON output", false)
     .action(async (name, opts) => {
       const root = program.opts().root;
       await openspecNewCommand({ root, name, json: opts.json });
     });

   program
     .command("openspec-status")
     .description("Show OpenSpec artifact status")
     .option("--json", "JSON output", false)
     .action(async (opts) => {
       const root = program.opts().root;
       await openspecStatusCommand({ root, json: opts.json });
     });

   program
     .command("openspec-check")
     .description("Validate OpenSpec artifacts")
     .option("--json", "JSON output", false)
     .action(async (opts) => {
       const root = program.opts().root;
       await openspecCheckCommand({ root, json: opts.json });
     });

   program
     .command("openspec-archive <name>")
     .description("Archive OpenSpec artifact")
     .option("--json", "JSON output", false)
     .action(async (name, opts) => {
       const root = program.opts().root;
       await openspecArchiveCommand({ root, name, json: opts.json });
     });

   // Modify init command to add --install-hooks and --install-ci
   program
     .command("init")
     .description("Create .ai/memory and .opencode scaffold in the target project")
     .option("--force", "overwrite existing files", false)
     .option("--dry-run", "show what would be written without writing", false)
     .option("--install-hooks", "install git hooks", false)
     .option("--install-ci", "install CI workflow", false)
     .action(async (opts) => {
       const root = program.opts().root;
       await initMemory({ root, force: opts.force, dryRun: opts.dryRun, installHooks: opts.installHooks, installCi: opts.installCi });
     });
   ```

6. Modify `src/index.ts` — export all Phase 3 modules:
   ```typescript
   // Add to existing exports
   export * from "./schemas/workflow.js";
   export * from "./schemas/session.js";
   export * from "./schemas/modelRouting.js";
   export * from "./core/changeSurface.js";
   export * from "./core/routeWorkflow.js";
   export * from "./core/sessionTracking.js";
   export * from "./core/modelRouting.js";
   ```

### Tests

Create `test/workflow.test.ts`:
- `analyzeChangeSurface`: 1 file changed → 1 component
- `analyzeChangeSurface`: no git repo → empty surface
- `routeWorkflow`: 1 component, 5 files, bugfix → DIRECT
- `routeWorkflow`: 2 components → PLAN
- `routeWorkflow`: security-boundary risk → FULL
- `routeWorkflow`: new-architecture risk → FULL
- `routeWorkflow`: 9 files → escalate to PLAN
- `routeWorkflow`: refactor with behaviorChange=false → DIRECT eligible
- `routeWorkflow`: refactor with behaviorChange=true → PLAN
- `routeWorkflow`: 3 components → FULL

Extend `test/cli.test.ts`:
- CLI route: --json outputs valid JSON
- CLI route: --base-ref passed to git diff
- CLI session-open: creates lane
- CLI session-close: updates status
- CLI profile: no args → shows current
- CLI profile quality: switches profile
- CLI openspec-new: delegates to openspec CLI

### Completion evidence
- `npm run build && npm test` pass
- `repo-memory route` writes route-manifest.json
- `repo-memory profile` shows active profile
- All Phase 3 commands registered and functional

---

## Task 8: G3 — Route integration into overview

### Outcome
Replace "Route reasons N/A" in overview.ts with real route manifest data if available.

### Files
- Modify: `src/core/overview.ts`
- Modify: `test/overview.test.ts`

### Implementation steps

1. **Prerequisite**: Ensure G2 (Task 1) changes to `overview.ts` are present (session tracking imports and "Session lanes" section). G3 modifies the same file — merge the route manifest section, do not overwrite G2's changes.

2. Modify `src/core/overview.ts`:
   ```typescript
   import { existsSync } from "node:fs";
   import { readFile } from "node:fs/promises";

   // In renderOverview function, replace "Route reasons N/A" section:
   const routeManifestPath = path.join(root, ".ai/memory-build/latest/route-manifest.json");
   let routeReasons = "N/A";
   if (existsSync(routeManifestPath)) {
     try {
       const manifestContent = await readFile(routeManifestPath, "utf8");
       const manifest = JSON.parse(manifestContent);
       const result = manifest.result;
       routeReasons = `Mode: ${result.mode.toUpperCase()}\n` +
         `Type: ${result.type}\n` +
         `Reasons:\n` +
         result.reasons.map((r: string) => `  - ${r}`).join("\n");
     } catch {
       routeReasons = "N/A (route manifest invalid)";
     }
   }
   sections.push(`## Route reasons\n${routeReasons}`);
   ```

### Tests

Extend `test/overview.test.ts`:
- `renderOverview`: no route manifest → "N/A"
- `renderOverview`: valid route manifest → shows mode/type/reasons
- `renderOverview`: invalid manifest JSON → "N/A (invalid)"

### Completion evidence
- `npm run build && npm test` pass
- OVERVIEW.md contains real route data after running `repo-memory route`

---

## Task 9: Integration verification

### Outcome
Full test suite green, version 0.6.0 → 0.7.0, CHANGELOG update, all CLI commands functional.

### Files
- Modify: `package.json` (version bump)
- New: `CHANGELOG.md` entry or modify existing

### Implementation steps

1. Run `npm run build` — must pass with zero errors

2. Run `npm test` — all tests must pass (~450+ tests expected)

3. Verify all new CLI commands with `--help`:
   - `npm run memory -- route --help`
   - `npm run memory -- session-open --help`
   - `npm run memory -- session-close --help`
   - `npm run memory -- profile --help`
   - `npm run memory -- openspec-new --help`
   - `npm run memory -- openspec-status --help`
   - `npm run memory -- openspec-check --help`
   - `npm run memory -- openspec-archive --help`

4. Bump version in `package.json`:
   ```json
   {
     "version": "0.7.0"
   }
   ```

5. Update CHANGELOG with Phase 3 changes:
   ```markdown
   # Changelog

   ## [0.7.0] - 2026-07-12

   ### Added
   - G1: Adaptive workflow modes (DIRECT/PLAN/FULL) with change surface analysis
   - G2: Session isolation tracking with execution lanes
   - G3: Route command with route manifest output
   - G4: Model routing profiles (quality/balanced/economy)
   - H1: Git hooks (pre-commit, pre-push, post-checkout, post-merge)
   - H2: CI integration (GitHub Actions workflow template)
   - H3: OpenSpec integration (optional, graceful degradation)
   - Integration debt: 3 OpenCode tools (legacyIngest, compact, artifactSearch)

   ### Changed
   - CLI: Added 8 new commands (route, session-open, session-close, profile, openspec-*)
   - init: Added --install-hooks and --install-ci flags
   - compaction.ts: Replaced "Active lane N/A" with real session data
   - overview.ts: Replaced "Session lanes N/A" and "Route reasons N/A" with real data
   - model-routing.yaml: Added profiles structure

   ### Fixed
   - None

   ## [0.6.0] - Previous release
   ```

### Completion evidence
- `npm run build && npm test` pass
- Version is `0.7.0`
- All 8 new commands respond to `--help`
- CHANGELOG documents Phase 3 changes
- Tools count: 8 → 11
- CLI commands: 28 → 36

---

## Summary

9 tasks across 2 domains (G, H) + integration debt + verification.

### Scope
- **G (Workflow orchestration)**: 4 epics — G1 workflow modes, G2 session tracking, G3 route integration, G4 model routing
- **H (Integration & automation)**: 3 epics — H1 git hooks, H2 CI, H3 OpenSpec
- **Integration debt**: 3 missing OpenCode tools
- **Verification**: full test suite + version bump

### New files
- 4 new schemas: workflow.ts, session.ts, modelRouting.ts
- 6 new core modules: changeSurface.ts, routeWorkflow.ts, sessionTracking.ts, modelRouting.ts
- 5 new command modules: route.ts, session.ts, profile.ts, openspec.ts
- 4 git hook templates: pre-commit, pre-push, post-checkout, post-merge
- 1 CI template: .github/workflows/memory-bank.yml
- 8 new test files: workflow.test.ts, sessionTracking.test.ts, modelRouting.test.ts, gitHooks.test.ts, ciTemplate.test.ts, openspec.test.ts

### Modified files
- `src/cli.ts` — add 8 new commands + modify init
- `src/index.ts` — export Phase 3 modules
- `src/commands/init.ts` — add hook/CI installation logic
- `src/scaffold/templates.ts` — add hook/CI templates
- `src/scaffold/templates/config/model-routing.yaml` — add profiles
- `src/scaffold/templates/tools/memory.ts` — add 3 tools
- `src/core/compaction.ts` — integrate session data
- `src/core/overview.ts` — integrate session + route data
- `package.json` — version 0.6.0 → 0.7.0
- `test/cli.test.ts` — extend for new commands

### CLI commands: 28 → 36 (8 new)
- route
- session-open
- session-close
- profile
- openspec-new
- openspec-status
- openspec-check
- openspec-archive

### OpenCode tools: 8 → 11 (3 new)
- legacyIngest
- compact
- artifactSearch

### Tests: 385 → ~450+ (65+ new tests estimated)

### Artifacts
- `.ai/memory-build/latest/route-manifest.json` — workflow route decisions
- `.ai/memory-build/latest/execution-sessions.json` — session tracking
- `.git/hooks/` — 4 git hooks (if --install-hooks)
- `.github/workflows/memory-bank.yml` — CI workflow (if --install-ci)

### File conflict resolution
Wave 1 lanes work independently on separate files. Wave 2 G1 lane owns cli.ts and index.ts, adding registrations for all Phase 3 commands. H1 lane owns init.ts and templates.ts, calling H2's CI logic. Clean separation, no concurrent edits.

---

**Phase 3 implementation plan complete. Ready for execution.**

