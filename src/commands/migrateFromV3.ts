import path from "node:path";
import { runMigration } from "../core/migrateFromV3.js";

export async function migrateFromV3Command(args: {
  root: string;
  v3Dir: string;
  force: boolean;
  dryRun: boolean;
  json: boolean;
  includeDocs: boolean;
  skipCoverage: boolean;
  preserveManifest: boolean;
  noAutoReview: boolean;
}): Promise<void> {
  const report = await runMigration(args.v3Dir, {
    root: args.root,
    force: args.force,
    dryRun: args.dryRun,
    includeDocs: args.includeDocs,
    skipCoverage: args.skipCoverage,
    preserveManifest: args.preserveManifest,
    noAutoReview: args.noAutoReview,
  });

  if (args.json) {
    console.log(JSON.stringify({
      command: "migrate-from-v3",
      v3Dir: args.v3Dir,
      target: path.resolve(args.root, ".ai/memory"),
      ...report,
    }, null, 2));
  } else {
    console.log(`Migrating v3 memory bank: ${args.v3Dir}`);
    console.log(`  Target: ${path.resolve(args.root, ".ai/memory")}/\n`);
    console.log(`Discovery:      ${report.discovered} cards found in knowledge/memory/`);
    console.log(`Migrated:       ${report.migrated} cards`);
    console.log(`Skipped:        ${report.skipped} cards (existing)`);
    console.log(`Errors:         ${report.errors}`);
    console.log(`Warnings:       ${report.warnings}\n`);
    if (!args.skipCoverage) console.log("Source coverage: copied and validated");
    if (args.preserveManifest) console.log("Source manifest: preserved");
    console.log(`\nPost-migration validation: ${report.errors === 0 ? "PASSED" : "FAILED"} (${report.errors} errors, ${report.warnings} warnings)`);
  }
}
