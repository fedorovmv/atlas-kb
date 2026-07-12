#!/usr/bin/env node
import { Command } from "commander";
import { listMemory } from "./commands/ls.js";
import { showMemory } from "./commands/show.js";
import { relatedMemory } from "./commands/related.js";
import { contextMemory } from "./commands/context.js";
import { validateMemoryCommand } from "./commands/validate.js";
import { initMemory } from "./commands/init.js";
import { discoverMemoryCommand } from "./commands/discover.js";
import { bootstrapMemoryCommand } from "./commands/bootstrap.js";
import { ingestSpecCommand } from "./commands/ingestSpec.js";
import { reconcileMemoryCommand } from "./commands/reconcile.js";
import { updateMemoryCommand } from "./commands/update.js";
import { triageCommand } from "./commands/triage.js";
import { planCommand } from "./commands/plan.js";
import { artifactsSearchCommand } from "./commands/artifactsSearch.js";
import { contextCheckCommand } from "./commands/contextCheck.js";
import { compactCommand } from "./commands/compact.js";
import { renderCommand } from "./commands/render.js";
import { semanticRepairCommand } from "./commands/semanticRepair.js";
import { legacyIngestCommand, legacyListCommand, legacyStatusCommand, legacyScaffoldCommand, legacyCheckCommand, legacyReviewPackCommand, legacyApproveCommand, legacyApplyCommand, legacyFinalizeCommand } from "./commands/legacyIngest.js";

const program = new Command();

program
  .name("repo-memory")
  .description("Markdown/frontmatter repository memory bank tool for coding agents")
  .version("0.1.0")
  .option("--root <path>", "repository root", process.cwd());

program
  .command("init")
  .description("Create .ai/memory and .opencode scaffold in the target project")
  .option("--force", "overwrite existing files", false)
  .option("--dry-run", "show what would be written without writing", false)
  .action(async (opts) => {
    const root = program.opts().root;
    await initMemory({ root, force: opts.force, dryRun: opts.dryRun });
  });

program
  .command("ls")
  .description("List memory cards")
  .option("--type <type>", "filter by entity_type")
  .option("--status <status>", "filter by status")
  .option("--json", "print JSON", false)
  .action(async (opts) => {
    const root = program.opts().root;
    await listMemory({ root, type: opts.type, status: opts.status, json: opts.json });
  });

program
  .command("show")
  .description("Show memory card by id")
  .argument("<id>", "memory entity id")
  .option("--json", "print JSON", false)
  .action(async (id, opts) => {
    const root = program.opts().root;
    await showMemory(id, { root, json: opts.json });
  });

program
  .command("related")
  .description("Show direct and reverse related memory entities")
  .argument("<id>", "memory entity id")
  .option("--json", "print JSON", false)
  .action(async (id, opts) => {
    const root = program.opts().root;
    await relatedMemory(id, { root, json: opts.json });
  });

program
  .command("context")
  .description("Build a compact memory context pack for a task or question")
  .argument("<query>", "task or question")
  .option("--limit <number>", "max primary cards", (value) => Number.parseInt(value, 10), 8)
  .option("--json", "print JSON", false)
  .action(async (query, opts) => {
    const root = program.opts().root;
    await contextMemory(query, { root, limit: opts.limit, json: opts.json });
  });

program
  .command("validate")
  .description("Validate memory frontmatter, policy invariants and relations")
  .option("--json", "print JSON", false)
  .option("--strict-warnings", "treat warnings as failures", false)
  .option("--require-source-coverage", "require source-coverage.json", false)
  .option("--check-dispatch", "check dispatch advisory (warnings only)", false)
  .option("--check-contract", "check structural completeness and markdown links", false)
  .option("--max-errors <n>", "max errors before truncation", "50")
  .action(async (opts) => {
    const root = program.opts().root;
    await validateMemoryCommand({
      root,
      json: opts.json,
      strictWarnings: opts.strictWarnings,
      requireSourceCoverage: opts.requireSourceCoverage,
      checkDispatch: opts.checkDispatch,
      checkContract: opts.checkContract,
      maxErrors: parseInt(opts.maxErrors, 10),
    });
  });

program
  .command("discover")
  .description("Discover project files and candidate modules")
  .option("--json", "print JSON", false)
  .action(async (opts) => {
    const root = program.opts().root;
    await discoverMemoryCommand({ root, json: opts.json });
  });

program
  .command("bootstrap")
  .description("Bootstrap memory bank from project discovery")
  .option("--force", "overwrite existing cards", false)
  .option("--dry-run", "preview without writing", false)
  .option("--json", "print JSON", false)
  .action(async (opts) => {
    const root = program.opts().root;
    await bootstrapMemoryCommand({ root, force: opts.force, dryRun: opts.dryRun, json: opts.json });
  });

program
  .command("ingest-spec")
  .description("Process a spec into proposal/historical/conflict memory")
  .argument("<spec>", "spec path or glob")
  .option("--force", "overwrite existing cards", false)
  .option("--dry-run", "preview without writing", false)
  .option("--json", "print JSON", false)
  .action(async (spec, opts) => {
    const root = program.opts().root;
    await ingestSpecCommand(spec, { root, force: opts.force, dryRun: opts.dryRun, json: opts.json });
  });

program
  .command("reconcile")
  .description("Report stale or mismatched memory")
  .option("--json", "print JSON", false)
  .option("--fix", "apply safe fixes to memory", false)
  .action(async (opts) => {
    const root = program.opts().root;
    await reconcileMemoryCommand({ root, json: opts.json, fix: opts.fix });
  });

program
  .command("update")
  .description("Safely update a memory card body or frontmatter fields by id")
  .argument("<id>", "memory entity id")
  .option("--body <text>", "new body content (replaces existing body)")
  .option("--body-file <path>", "read new body from file")
  .option("--set <field=value>", "set a frontmatter field (can repeat, value parsed as JSON if possible)", (value: string, previous: string[]) => [...(previous ?? []), value], [])
  .option("--json", "print JSON", false)
  .action(async (id, opts) => {
    const root = program.opts().root;
    await updateMemoryCommand(id, { root, body: opts.body, bodyFile: opts.bodyFile, set: opts.set, json: opts.json });
  });

program
  .command("triage")
  .description("Run automatic source triage")
  .option("--build-dir <dir>", "Build directory")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = program.opts().root;
    await triageCommand({ root, ...opts });
  });

program
  .command("plan")
  .description("Generate card plan from discovery")
  .option("--build-dir <dir>", "Build directory")
  .option("--scaffold-modules", "Create module/architecture stubs", false)
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = program.opts().root;
    await planCommand({ root, ...opts });
  });

program
  .command("artifacts-search <query>")
  .description("Search artifact index")
  .option("--root <path>", "repository root", undefined)
  .option("--limit <n>", "max results", "8")
  .option("--json", "JSON output", false)
  .action(async (query, opts) => {
    const root = opts.root ?? program.opts().root;
    await artifactsSearchCommand({ root, query, limit: parseInt(opts.limit, 10), json: opts.json });
  });

program
  .command("context-check")
  .description("Check context pack freshness")
  .option("--root <path>", "repository root", undefined)
  .option("--query <text>", "query for context pack", "")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await contextCheckCommand({ root, query: opts.query, json: opts.json });
  });

program
  .command("compact")
  .description("Build bounded compaction of memory context")
  .option("--root <path>", "repository root", undefined)
  .option("--max-chars <n>", "max chars", "12000")
  .option("--no-truncate", "error instead of truncating", false)
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await compactCommand({ root, maxChars: parseInt(opts.maxChars, 10), noTruncate: opts.noTruncate, json: opts.json });
  });

program
  .command("render")
  .description("Render OVERVIEW.md from memory bank")
  .option("--root <path>", "repository root", undefined)
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await renderCommand({ root, json: opts.json });
  });

program
  .command("semantic-repair")
  .description("Run semantic repair on memory cards")
  .option("--root <path>", "repository root", undefined)
  .option("--build-dir <dir>", "build directory")
  .option("--run-check", "run validate after repair", false)
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await semanticRepairCommand({ root, buildDir: opts.buildDir, runCheck: opts.runCheck, json: opts.json });
  });

// Legacy ingestion commands (E4)
program
  .command("legacy-ingest <sources...>")
  .description("Ingest legacy documents into classification pipeline")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name")
  .option("--json", "JSON output", false)
  .action(async (sources, opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyIngestCommand({ root, sources, batch: opts.batch, json: opts.json });
  });

program
  .command("legacy-list")
  .description("List legacy candidates in batch")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name", "default")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyListCommand({ root, batch: opts.batch, json: opts.json });
  });

program
  .command("legacy-status")
  .description("Show legacy batch status")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name", "default")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyStatusCommand({ root, batch: opts.batch, json: opts.json });
  });

program
  .command("legacy-scaffold")
  .description("Scaffold staged legacy docs")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name", "default")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyScaffoldCommand({ root, batch: opts.batch, json: opts.json });
  });

program
  .command("legacy-check")
  .description("Validate legacy candidate evidence")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name", "default")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyCheckCommand({ root, batch: opts.batch, json: opts.json });
  });

program
  .command("legacy-review-pack")
  .description("Generate review pack for legacy batch")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name", "default")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyReviewPackCommand({ root, batch: opts.batch, json: opts.json });
  });

program
  .command("legacy-approve <id>")
  .description("Approve a legacy candidate")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name", "default")
  .option("--json", "JSON output", false)
  .action(async (id, opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyApproveCommand(id, { root, batch: opts.batch, json: opts.json });
  });

program
  .command("legacy-apply")
  .description("Apply approved legacy candidates")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name", "default")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyApplyCommand({ root, batch: opts.batch, json: opts.json });
  });

program
  .command("legacy-finalize")
  .description("Finalize legacy batch")
  .option("--root <path>", "repository root", undefined)
  .option("--batch <name>", "batch name", "default")
  .option("--json", "JSON output", false)
  .action(async (opts) => {
    const root = opts.root ?? program.opts().root;
    await legacyFinalizeCommand({ root, batch: opts.batch, json: opts.json });
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
