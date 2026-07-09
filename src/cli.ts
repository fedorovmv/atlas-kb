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
  .action(async (opts) => {
    const root = program.opts().root;
    await validateMemoryCommand({ root, json: opts.json, strictWarnings: opts.strictWarnings });
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

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
