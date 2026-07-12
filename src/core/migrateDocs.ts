/**
 * Migration helpers for v3 `knowledge/docs/` → `.ai/memory/` layout.
 *
 * V3 docs use `node_type` frontmatter (different from memory cards' `memory_card_type`).
 * This module maps v3 docs into the ts-kb-flow entity_type + subdir scheme.
 */

import { z } from "zod";
import path from "node:path";
import { readFile } from "node:fs/promises";
import fg from "fast-glob";
import matter from "gray-matter";

// ── Schemas ──────────────────────────────────────────────────────────────────

/**
 * Docs frontmatter schema (v3 `knowledge/docs/` uses `node_type`, not `memory_card_type`).
 */
export const V3DocsFrontmatterSchema = z.object({
  node_type: z.string(),
  title: z.string().optional(),
  status: z.string().optional(),
  service: z.string().optional(),
  updated: z.string().optional(),
  tags: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
}).passthrough();

export type V3DocsFrontmatter = z.infer<typeof V3DocsFrontmatterSchema>;

export interface V3Doc {
  relativePath: string;
  frontmatter: V3DocsFrontmatter;
  body: string;
  filename: string;
}

export interface MigratedDoc {
  frontmatter: Record<string, unknown>;
  body: string;
  warnings: string[];
}

// ── Type mapping ─────────────────────────────────────────────────────────────

/** Type mapping: v3 node_type → ts-kb-flow entity_type + subdir */
export const DOCS_TYPE_MAP: Record<string, { entity_type: string; subdir: string }> = {
  service: { entity_type: "module", subdir: "modules" },
  reference: { entity_type: "reference", subdir: "reference" },
  decision: { entity_type: "decision", subdir: "decisions" },
  runbook: { entity_type: "ops", subdir: "ops" },
  gotcha: { entity_type: "gotchas", subdir: "gotchas" },
  guide: { entity_type: "reference", subdir: "reference" },
  index: { entity_type: "readme", subdir: "" },
};

const DEFAULT_MAPPING = { entity_type: "reference", subdir: "reference" };

// ── Status/stability maps ────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  active: "current",
  draft: "proposed",
  deprecated: "deprecated",
  archived: "historical",
};

const STABILITY_MAP: Record<string, string> = {
  active: "stable",
  draft: "evolving",
  deprecated: "deprecated",
  archived: "deprecated",
};

// ── Core functions ───────────────────────────────────────────────────────────

/**
 * Given a v3 docs path and node_type, compute the target `.ai/memory/` path.
 *
 * Strips `knowledge/docs/` prefix, replaces the v3 subdir with the mapped subdir
 * from DOCS_TYPE_MAP, and prepends `.ai/memory/`.
 */
export function mapDocsPath(v3DocsPath: string, nodeType: string): string {
  const mapping = DOCS_TYPE_MAP[nodeType] ?? DEFAULT_MAPPING;
  const subdir = mapping.subdir;

  // Strip `knowledge/docs/` prefix to get the relative portion
  const relative = v3DocsPath.startsWith("knowledge/docs/")
    ? v3DocsPath.slice("knowledge/docs/".length)
    : v3DocsPath;

  const filename = path.basename(relative);

  if (!subdir) {
    // Top-level (e.g., index → `.ai/memory/index.md`)
    return `.ai/memory/${filename}`;
  }

  return `.ai/memory/${subdir}/${filename}`;
}

/**
 * Walk knowledge/docs markdown files under v3Dir and parse each document.
 *
 * Returns an array of V3Doc objects with parsed frontmatter.
 */
export async function discoverV3Docs(v3Dir: string): Promise<V3Doc[]> {
  const docsDir = path.join(v3Dir, "knowledge", "docs");
  const pattern = "knowledge/docs/**/*.md";

  const files = await fg(pattern, {
    cwd: v3Dir,
    onlyFiles: true,
  });

  const docs: V3Doc[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(v3Dir, relativePath);
    try {
      const raw = await readFile(absolutePath, "utf8");
      if (!raw.trimStart().startsWith("---")) {
        // No frontmatter — skip
        continue;
      }

      const parsed = matter(raw);
      const frontmatter = V3DocsFrontmatterSchema.parse(parsed.data);
      const body = parsed.content;
      const filename = path.basename(relativePath);

      docs.push({ relativePath, frontmatter, body, filename });
    } catch {
      // Skip files that fail to parse
    }
  }

  return docs.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Migrate a single v3 doc into ts-kb-flow memory card format.
 *
 * Synthesizes frontmatter with all required fields, prepends a body comment
 * preserving the original node_type, and collects warnings for unknown types.
 */
export function migrateDoc(
  v3Doc: V3Doc,
  options: { noAutoReview?: boolean } = {},
): MigratedDoc {
  const warnings: string[] = [];
  const nodeType = v3Doc.frontmatter.node_type ?? "";
  const mapping = DOCS_TYPE_MAP[nodeType];

  if (!mapping) {
    warnings.push(
      `Unknown node_type "${nodeType}" — defaulting to entity_type=reference, subdir=reference`,
    );
  }

  const effectiveMapping = mapping ?? DEFAULT_MAPPING;
  const entity_type = effectiveMapping.entity_type;

  // ── id: slug from filename ───────────────────────────────────────
  let rawId = v3Doc.filename.endsWith(".md")
    ? v3Doc.filename.slice(0, -3)
    : v3Doc.filename;
  rawId = rawId.replace(/[/]/g, "-").toLowerCase();
  // Ensure id regex: /^[a-z0-9][a-z0-9\-_.]*$/
  if (rawId.length > 0 && !/^[a-z0-9]/.test(rawId[0])) {
    rawId = rawId.replace(/^[^a-z0-9]+/, "");
  }
  const id = rawId;

  // ── title ────────────────────────────────────────────────────────
  const title = v3Doc.frontmatter.title ?? deriveTitle(v3Doc.filename);

  // ── status ───────────────────────────────────────────────────────
  const v3Status = v3Doc.frontmatter.status ?? "";
  const status = STATUS_MAP[v3Status] ?? "current";

  // ── stability ────────────────────────────────────────────────────
  const stability = STABILITY_MAP[v3Status] ?? "unknown";

  // ── last_reviewed ────────────────────────────────────────────────
  let last_reviewed = new Date().toISOString().slice(0, 10);
  if (v3Doc.frontmatter.updated) {
    const candidate = v3Doc.frontmatter.updated.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      last_reviewed = candidate;
    }
  }

  // ── frontmatter ──────────────────────────────────────────────────
  const frontmatter: Record<string, unknown> = {
    entity_type,
    id,
    title,
    status,
    authority: "reviewed_memory",
    evidence_level: "reviewed_doc",
    stability,
    source_confidence: "medium",
    last_reviewed,
    review_required: options.noAutoReview ? false : true,
    knowledge_types: ["current_behavior"],
    product_areas: [],
    usage_policy: {
      can_answer_current_behavior: true,
      can_generate_code_from: false,
      can_use_as_rationale: true,
      can_use_as_example: false,
      requires_code_check_before_change: true,
      requires_warning: false,
    },
  };

  // ── body (prepend v3 node_type comment) ──────────────────────────
  const bodyComment = `<!-- v3: node_type=${nodeType} -->\n`;
  const body = bodyComment + v3Doc.body;

  return { frontmatter, body, warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a title from a filename: strip `.md`, replace `-`/`_` with spaces, title-case.
 */
function deriveTitle(filename: string): string {
  let name = filename.endsWith(".md") ? filename.slice(0, -3) : filename;
  name = name.replace(/[-_]/g, " ");
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
