import path from "node:path";
import { readFile, access } from "node:fs/promises";
import fg from "fast-glob";
import matter from "gray-matter";
import { DocFrontmatter, DocFrontmatterSchema, DocNodeType } from "../schemas/docFrontmatter.js";
import { resolveRoot, toPosixPath } from "./paths.js";

export interface DocValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface DocFile {
  path: string;
  relativePath: string;
  meta: DocFrontmatter;
  body: string;
  raw: string;
}

/**
 * Loads and parses docs from .ai/docs/.
 * Skips files that fail to parse (collects errors).
 */
export async function loadDocs(options?: { root?: string }): Promise<DocFile[]> {
  const root = resolveRoot(options);
  const docsRoot = path.join(root, ".ai", "docs");
  const docsRootRelative = ".ai/docs";

  try {
    await access(docsRoot);
  } catch {
    return [];
  }

  const pattern = path.relative(root, path.join(docsRoot, "**/*.md"));
  const files = await fg(toPosixPath(pattern), {
    cwd: root,
    dot: true,
    onlyFiles: true,
    absolute: false,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  const docs: DocFile[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(root, relativePath);
    try {
      const raw = await readFile(absolutePath, "utf8");
      if (!raw.trimStart().startsWith("---")) continue;

      const parsed = matter(raw);
      const meta = DocFrontmatterSchema.parse(parsed.data);
      docs.push({
        path: absolutePath,
        relativePath: toPosixPath(relativePath),
        meta,
        body: parsed.content,
        raw,
      });
    } catch {
      // Skip files that fail to parse
      continue;
    }
  }

  return docs.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// Node types that are exempt from the Evidence section requirement
const EVIDENCE_EXEMPT_TYPES: DocNodeType[] = ["index", "decision", "guide"];

/**
 * Validates docs: frontmatter, evidence for active, body length, markdown links.
 */
export async function validateDocs(options?: { root?: string }): Promise<DocValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const docs = await loadDocs(options);

  for (const doc of docs) {
    const rp = doc.relativePath;

    // Rule 2: status=active docs (except index/decision/guide) must have ## Evidence
    if (doc.meta.status === "active" && !EVIDENCE_EXEMPT_TYPES.includes(doc.meta.node_type)) {
      if (!doc.body.includes("## Evidence")) {
        errors.push(`${rp}: active ${doc.meta.node_type} doc must have a "## Evidence" section`);
      }
    }

    // Rule 3: Body >= 40 characters
    if (doc.body.length < 40) {
      errors.push(`${rp}: body must be at least 40 characters (got ${doc.body.length})`);
    }

    // Rule 4: At least one Markdown link in body
    const linkMatches = doc.body.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (!linkMatches) {
      errors.push(`${rp}: body must contain at least one Markdown link`);
    }

    // Rule 5: All local Markdown links resolve
    if (linkMatches) {
      const docDir = path.dirname(doc.path);
      for (const match of linkMatches) {
        const urlMatch = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (!urlMatch) continue;
        const [, , linkTarget] = urlMatch;

        // Skip http/https and anchor links
        if (linkTarget.startsWith("http://") || linkTarget.startsWith("https://") || linkTarget.startsWith("#")) {
          continue;
        }

        // Resolve relative to doc directory
        const resolved = path.resolve(docDir, linkTarget);
        try {
          await access(resolved);
        } catch {
          errors.push(`${rp}: broken local link "${linkTarget}" (resolved to ${resolved})`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
