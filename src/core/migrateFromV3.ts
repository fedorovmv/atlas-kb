import path from "node:path";
import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import fg from "fast-glob";
import matter from "gray-matter";

import type {
  V3Card,
  MigrationResult,
  MigrationReport,
} from "../schemas/migrateFromV3.js";
import type { V3Frontmatter, MigrationOptions } from "../schemas/migrateFromV3.js";
import { V3FrontmatterSchema, ENTITY_TYPE_MAP } from "../schemas/migrateFromV3.js";

export type MigrationOptionsWithRoot = MigrationOptions & {
  root?: string;
};
import { MemoryFrontmatterSchema } from "../schemas/frontmatter.js";
import { SourceCoverageSchema } from "../schemas/sourceCoverage.js";

import { synthesizeFrontmatter, decorateBody } from "./migrateSynthesis.js";
import {
  mapRelatedCards,
  mapOwnedPaths,
  mapScope,
  idToTargetPath,
  ENTITY_TYPE_TO_SUBDIR,
} from "./migratePaths.js";
import { discoverV3Docs, migrateDoc, mapDocsPath } from "./migrateDocs.js";

import { resolveRoot, resolveMemoryRoot } from "./paths.js";
import { frontmatterYaml } from "./utils.js";
import { validateMemory } from "./validate.js";

export async function discoverV3Cards(v3Dir: string): Promise<V3Card[]> {
  const pattern = "knowledge/memory/**/*.md";

  const files = await fg(pattern, {
    cwd: v3Dir,
    onlyFiles: true,
  });

  const cards: V3Card[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(v3Dir, relativePath);
    try {
      const raw = await readFile(absolutePath, "utf8");
      const parsed = matter(raw);
      const result = V3FrontmatterSchema.safeParse(parsed.data);
      if (!result.success) {
        console.error(
          `warning: skipping ${relativePath}: invalid frontmatter - ${result.error.message}`
        );
        continue;
      }
      const filename = path.basename(relativePath);
      cards.push({
        relativePath,
        frontmatter: result.data,
        body: parsed.content,
        filename,
      });
    } catch (err) {
      console.error(
        `warning: skipping ${relativePath}: failed - ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return cards.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function migrateCard(
  v3Card: V3Card,
  options: MigrationOptions,
  usedIds: Set<string>,
): MigrationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const v3fm = v3Card.frontmatter;

  const mappedType = ENTITY_TYPE_MAP[v3fm.memory_card_type];
  if (mappedType === undefined) {
    warnings.push(
      `Unknown memory_card_type "${v3fm.memory_card_type}" - defaulting to reference`
    );
  }

  const frontmatter = synthesizeFrontmatter(
    v3fm,
    { noAutoReview: options.noAutoReview },
    v3Card.filename,
    usedIds,
  );

  const relatedMapping = mapRelatedCards(v3fm.related_cards ?? [], "");
  frontmatter.related_modules = [
    ...(frontmatter.related_modules ?? []),
    ...relatedMapping.related_modules,
  ];
  frontmatter.related_scenarios = [
    ...(frontmatter.related_scenarios ?? []),
    ...relatedMapping.related_scenarios,
  ];
  frontmatter.related_decisions = [
    ...(frontmatter.related_decisions ?? []),
    ...relatedMapping.related_decisions,
  ];
  frontmatter.related_specs = [
    ...(frontmatter.related_specs ?? []),
    ...relatedMapping.related_specs,
  ];

  const codeRefs = mapOwnedPaths(v3fm.owned_paths ?? []);
  if (codeRefs.length > 0) {
    frontmatter.code_refs = codeRefs;
  }

  const productAreas = mapScope(v3fm.scope);
  if (productAreas.length > 0) {
    frontmatter.product_areas = productAreas;
  }

  const decoratedBody = decorateBody(v3Card.body, v3fm);
  const fullContent = `---\n${frontmatterYaml(frontmatter)}\n---\n\n${decoratedBody}\n`;

  return { frontmatter, body: fullContent, warnings, errors };
}

export async function migrateSourceCoverage(
  v3Dir: string,
  targetDir: string,
): Promise<boolean> {
  try {
    const coveragePath = path.join(v3Dir, "knowledge", "memory", "source-coverage.json");
    const raw = await readFile(coveragePath, "utf8");
    const coverage = SourceCoverageSchema.parse(JSON.parse(raw));

    for (const entry of coverage.entries) {
      entry.targetCards = entry.targetCards.map((p) => {
        const filename = path.basename(p, ".md");
        return filename.toLowerCase().replace(/[^a-z0-9\-_.]/g, "-").replace(/^[-_.]+/, "");
      });
    }

    const targetPath = path.join(targetDir, "source-coverage.json");
    await atomicWrite(targetPath, JSON.stringify(coverage, null, 2));
    return true;
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      // coverage file missing — ok, skip
      return false;
    }
    // genuine error — warn but don't fail migration
    console.warn("source-coverage.json migration failed:", err);
    return false;
  }
}

export async function migrateSourceManifest(
  v3Dir: string,
  targetDir: string,
): Promise<boolean> {
  try {
    const manifestPath = path.join(v3Dir, "knowledge", "memory", "source-manifest.json");
    const raw = await readFile(manifestPath, "utf8");
    const targetPath = path.join(targetDir, "source-manifest.json");
    await atomicWrite(targetPath, raw);
    return true;
  } catch {
    return false;
  }
}

export async function createStagingDir(root: string): Promise<string> {
  const stagingDir = path.join(root, ".ai", "memory-build", "v3-migration");
  for (const sub of ["migrated", "skipped", "errors"]) {
    await mkdir(path.join(stagingDir, sub), { recursive: true });
  }

  const plan = {
    v3Dir: "",
    targetDir: "",
    timestamp: new Date().toISOString(),
    discovered: 0,
  };
  await atomicWrite(
    path.join(stagingDir, "migration-plan.json"),
    JSON.stringify(plan, null, 2),
  );
  return stagingDir;
}

export async function logMigrationEntry(
  stagingDir: string,
  entry: { cardPath: string; status: "migrated" | "skipped" | "error"; message?: string },
): Promise<void> {
  const logPath = path.join(stagingDir, "log.jsonl");
  const line = JSON.stringify(entry) + "\n";
  try {
    await writeFile(logPath, line, { flag: "a" });
  } catch {
    await writeFile(logPath, line);
  }
}

export function ensureTargetSubdirs(targetDir: string, entityTypes: string[]): void {
  const subdirs = new Set<string>();
  for (const et of entityTypes) {
    const subdir = ENTITY_TYPE_TO_SUBDIR[et];
    if (subdir && subdir !== "") {
      subdirs.add(subdir);
    }
  }
  for (const subdir of subdirs) {
    mkdirSync(path.join(targetDir, subdir), { recursive: true });
  }
}

export async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const dir = path.dirname(targetPath);
  await mkdir(dir, { recursive: true });
  const tmpPath = `${targetPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, targetPath);
}

function getTargetPath(frontmatter: Record<string, unknown>, targetDir: string): string {
  const id = (frontmatter.id as string) ?? "";
  const entityType = (frontmatter.entity_type as string) ?? "reference";
  const relativePath = idToTargetPath(id, entityType);
  return path.join(targetDir, relativePath);
}

export async function runMigration(
  v3Dir: string,
  options: MigrationOptionsWithRoot = {},
): Promise<MigrationReport> {
  const root = resolveRoot({ root: options.root });
  const targetDir = resolveMemoryRoot({ root: options.root });
  const stagingDir = await createStagingDir(root);

  const report: MigrationReport = {
    discovered: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    warnings: 0,
    byEntityType: {},
  };

  const cards = await discoverV3Cards(v3Dir);
  report.discovered = cards.length;

  const planPath = path.join(stagingDir, "migration-plan.json");
  const plan = {
    v3Dir,
    targetDir,
    timestamp: new Date().toISOString(),
    discovered: report.discovered,
  };
  await atomicWrite(planPath, JSON.stringify(plan, null, 2));

  const usedIds = new Set<string>();

  const entityTypes = new Set<string>();
  for (const card of cards) {
    const mappedType = ENTITY_TYPE_MAP[card.frontmatter.memory_card_type];
    entityTypes.add(mappedType ?? "reference");
  }
  ensureTargetSubdirs(targetDir, [...entityTypes]);

  for (const card of cards) {
    const mappedType = ENTITY_TYPE_MAP[card.frontmatter.memory_card_type] ?? "reference";
    const result = migrateCard(card, options, usedIds);

    report.warnings += result.warnings.length;
    report.errors += result.errors.length;
    for (const w of result.warnings) {
      console.error(`warning: ${card.relativePath}: ${w}`);
    }
    for (const e of result.errors) {
      console.error(`error: ${card.relativePath}: ${e}`);
    }

    report.byEntityType[mappedType] = (report.byEntityType[mappedType] ?? 0) + 1;

    const targetPath = getTargetPath(result.frontmatter, targetDir);

    if (existsSync(targetPath) && !options.force) {
      report.skipped += 1;
      await logMigrationEntry(stagingDir, {
        cardPath: card.relativePath,
        status: "skipped",
        message: "target already exists (use --force to overwrite)",
      });
      continue;
    }

    if (options.dryRun) {
      report.migrated += 1;
      continue;
    }

    try {
      await atomicWrite(targetPath, result.body);
      report.migrated += 1;
      await logMigrationEntry(stagingDir, {
        cardPath: card.relativePath,
        status: "migrated",
      });
    } catch (err) {
      report.errors += 1;
      await logMigrationEntry(stagingDir, {
        cardPath: card.relativePath,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (options.includeDocs) {
    const docs = await discoverV3Docs(v3Dir);
    for (const doc of docs) {
      try {
        const migratedDoc = migrateDoc(doc, { noAutoReview: options.noAutoReview });
        report.warnings += migratedDoc.warnings.length;

        const docTargetRelative = mapDocsPath(doc.relativePath, doc.frontmatter.node_type ?? "");
        const docTargetPath = path.join(targetDir, docTargetRelative.replace(/^\.ai\/memory\//, ""));

        if (!options.dryRun) {
          const docContent = `---\n${frontmatterYaml(migratedDoc.frontmatter)}\n---\n\n${migratedDoc.body}\n`;
          await atomicWrite(docTargetPath, docContent);
        }
        report.migrated += 1;
      } catch (err) {
        report.errors += 1;
        console.error(
          `error: migrating doc ${doc.relativePath}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  if (!options.skipCoverage) {
    const covOk = await migrateSourceCoverage(v3Dir, targetDir);
    if (!covOk) {
      console.error("warning: source-coverage.json migration failed");
    }
  }

  if (options.preserveManifest) {
    const manOk = await migrateSourceManifest(v3Dir, targetDir);
    if (!manOk) {
      console.error("warning: source-manifest.json migration failed");
    }
  }

  const dropFiles = ["index.json", "memory-contract.json"];
  for (const gf of dropFiles) {
    const srcPath = path.join(v3Dir, "knowledge", "memory", gf);
    if (existsSync(srcPath)) {
      console.error(`info: dropping ${gf} (not copied to target)`);
    }
  }

  if (report.migrated > 0 && !options.dryRun) {
    try {
      const validationResult = await validateMemory({ root: options.root });
      for (const w of validationResult.warnings) {
        console.error(`post-migration warning: ${w}`);
        report.warnings += 1;
      }
      for (const e of validationResult.errors) {
        console.error(`post-migration error: ${e}`);
        report.errors += 1;
      }
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        // missing structural files is fine — fresh target
      } else {
        report.warnings += 1;
      }
    }
  }

  await atomicWrite(planPath, JSON.stringify({
    ...plan,
    migrated: report.migrated,
    skipped: report.skipped,
    errors: report.errors,
    warnings: report.warnings,
  }, null, 2));

  return report;
}

export { V3Card, V3Frontmatter, MigrationOptions, MigrationResult, MigrationReport };
