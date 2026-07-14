import path from "node:path";
import { stat, readFile } from "node:fs/promises";
import fg from "fast-glob";
import { resolveRoot, toPosixPath } from "./paths.js";
import type { RepoMemoryOptions } from "./types.js";
import { DiscoveryReportSchema } from "../schemas/discovery.js";
import type { FileRecord, CandidateModule, DiscoveryReport } from "../schemas/discovery.js";

// ── Ignore patterns ──────────────────────────────────────────────────────────

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/.ai/memory/**",
  "**/vendor/**",
  "**/third_party/**",
  "**/.opencode/**",
  "**/tmp/**",
  "**/backups/**",
  "**/.backup/**",
  "**/tmp-backup/**",
];

// ── Heuristic classification ─────────────────────────────────────────────────

const CODE_EXTS = new Set([".go", ".ts", ".js", ".py", ".java", ".proto"]);
const DOC_EXTS = new Set([".md"]);
const CONFIG_EXTS = new Set([".yaml", ".yml", ".json"]);

const PATH_SEGMENT_KINDS: Record<string, FileRecord["kind"]> = {
  test: "test",
  tests: "test",
  testdata: "test",
  spec: "spec",
  specs: "spec",
  docs: "doc",
  doc: "doc",
  demo: "demo",
  example: "example",
  examples: "example",
  legacy: "legacy",
  archive: "legacy",
  deprecated: "legacy",
  internal: "code",
  pkg: "code",
  cmd: "code",
};

// Priority ranking: higher number = higher priority (wins over others)
// Code directories (internal/pkg/cmd) take priority over demo/example
// because demo projects still have real code in internal/pkg/cmd paths.
const KIND_PRIORITY: Record<string, number> = {
  unknown: 0,
  code: 6,
  config: 2,
  contract: 2,
  doc: 3,
  example: 4,
  demo: 5,
  spec: 7,
  legacy: 8,
  test: 9,
};

const TEST_FILENAME_TOKENS = ["test_", "_test", ".test", "spec_", "_spec"];

const COMMON_DIRS = new Set([
  "internal",
  "pkg",
  "cmd",
  "vendor",
  "third_party",
  "thirdparty",
  "node_modules",
  "dist",
  "build",
  "__pycache__",
]);

function detectLanguage(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase();
  const langMap: Record<string, string> = {
    ".go": "go",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".java": "java",
    ".proto": "protobuf",
    ".md": "markdown",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
  };
  return langMap[ext];
}

/**
 * Extract individual tokens from a hyphenated/underscored name.
 * "demo-agent" → ["demo", "agent"]
 */
function splitNameTokens(name: string): string[] {
  return name.split(/[-_]/);
}

function classifyFile(relativePath: string): { kind: FileRecord["kind"]; signals: string[] } {
  const segments = relativePath.split("/");
  const basename = path.basename(relativePath);
  const ext = path.extname(basename).toLowerCase();
  const signals: string[] = [];

  // Check filename tokens first (test file co-located with code)
  const baseNoExt = basename.slice(0, basename.lastIndexOf("."));
  for (const token of TEST_FILENAME_TOKENS) {
    if (baseNoExt.includes(token)) {
      signals.push(`filename contains test token: "${token}"`);
      return { kind: "test", signals };
    }
  }

  // Walk all path segments (excluding filename), check each segment
  // and also split hyphenated/underscored segments for more granular matching
  let bestKind: FileRecord["kind"] = "unknown";
  let bestPriority = 0;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];

    // Direct match
    const directKind = PATH_SEGMENT_KINDS[seg];
    if (directKind) {
      signals.push(`path segment "${seg}" suggests ${directKind}`);
      const prio = KIND_PRIORITY[directKind] ?? 0;
      if (prio > bestPriority) {
        bestPriority = prio;
        bestKind = directKind;
      }
    }

    // Also check sub-tokens from hyphenated/underscored names
    const tokens = splitNameTokens(seg);
    for (const token of tokens) {
      const tokKind = PATH_SEGMENT_KINDS[token];
      if (tokKind) {
        signals.push(`path segment token "${token}" (from "${seg}") suggests ${tokKind}`);
        const prio = KIND_PRIORITY[tokKind] ?? 0;
        if (prio > bestPriority) {
          bestPriority = prio;
          bestKind = tokKind;
        }
      }
    }
  }

  // Extension-based fallback
  if (bestKind === "unknown") {
    if (CODE_EXTS.has(ext)) {
      bestKind = "code";
      signals.push(`extension "${ext}" suggests code`);
    } else if (DOC_EXTS.has(ext)) {
      bestKind = "doc";
      signals.push(`extension "${ext}" suggests doc`);
    } else if (CONFIG_EXTS.has(ext)) {
      bestKind = "config";
      signals.push(`extension "${ext}" suggests config`);
    }
  }

  return { kind: bestKind, signals };
}

// ── Topic extraction ─────────────────────────────────────────────────────────

function extractTopicsFromPath(relativePath: string): string[] {
  const segments = relativePath.split("/");
  const basename = path.basename(relativePath).replace(path.extname(relativePath), "");
  const topics = new Set<string>();

  for (const seg of segments) {
    if (!COMMON_DIRS.has(seg)) {
      topics.add(seg.toLowerCase());
    }
  }

  // Extract words from basename (snake_case → kebab, strip test_ prefix)
  const cleaned = basename
    .replace(/^(test_|_test)$/, "")
    .replace(/_/g, "-");
  if (cleaned.length > 1) {
    topics.add(cleaned.toLowerCase());
  }

  return Array.from(topics);
}

function extractTopicsFromMarkdownBody(body: string): string[] {
  const topics = new Set<string>();
  // Extract H1/H2 headings
  const headingRegex = /^##?\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(body)) !== null) {
    const heading = match[1].trim().toLowerCase();
    // Skip generic headings
    if (!["overview", "notes", "todo", "changelog"].includes(heading)) {
      topics.add(heading);
    }
  }
  return Array.from(topics);
}

function extractTopicsFromGoPackage(content: string): string[] {
  const topics = new Set<string>();
  const pkgMatch = content.match(/^package\s+(\w+)/m);
  if (pkgMatch && !COMMON_DIRS.has(pkgMatch[1])) {
    topics.add(pkgMatch[1].toLowerCase());
  }
  // Extract commented terms (doc comments)
  const commentMatch = content.match(/\/\/\s+(\w+)/);
  if (commentMatch) {
    topics.add(commentMatch[1].toLowerCase());
  }
  return Array.from(topics);
}

// ── Candidate module grouping ────────────────────────────────────────────────

/**
 * Derive a module prefix for grouping. For files under common dirs like
 * internal/, pkg/, cmd/, the prefix is `internal/module-name` (2 segments
 * after the common dir). For others, it's the first 2 directory components.
 */
function modulePrefix(relativePath: string): string {
  const segments = relativePath.split("/");
  // Find and skip the common-dir anchor
  let anchorIdx = -1;
  for (let i = 0; i < segments.length - 1; i++) {
    if (COMMON_DIRS.has(segments[i])) {
      anchorIdx = i;
      break;
    }
  }

  if (anchorIdx >= 0) {
    // Take common-dir + next segment as the prefix
    const prefixParts = segments.slice(anchorIdx, Math.min(anchorIdx + 2, segments.length));
    return prefixParts.join("/");
  }

  // No common-dir anchor — use first 1-2 directory components
  const dirSegments = segments.slice(0, -1); // exclude filename
  const prefixParts = dirSegments.slice(0, Math.max(dirSegments.length, 1));
  return prefixParts.join("/");
}

function toModuleId(prefix: string): string {
  // Take last meaningful path component, convert to kebab-case
  const parts = prefix.replace(/\/$/, "").split("/").filter(Boolean);
  const id = parts.join("-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return id || "unnamed";
}

function groupCandidateModules(files: FileRecord[]): CandidateModule[] {
  // Phase 1: group files by module prefix
  const groups = new Map<string, FileRecord[]>();

  for (const file of files) {
    // Skip demo/example files from module grouping (they are evidence, not production)
    if (file.kind === "demo" || file.kind === "example") continue;

    const prefix = modulePrefix(file.path);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(file);
  }

  const modules: CandidateModule[] = [];

  for (const [prefix, groupFiles] of groups) {
    const codeFiles = groupFiles
      .filter((f) => f.kind === "code")
      .map((f) => f.path);
    const testFiles = groupFiles
      .filter((f) => f.kind === "test")
      .map((f) => f.path);
    const docFiles = groupFiles
      .filter((f) => f.kind === "doc")
      .map((f) => f.path);
    const specFiles = groupFiles
      .filter((f) => f.kind === "spec" || f.kind === "legacy")
      .map((f) => f.path);

    // Skip empty groups
    if (codeFiles.length === 0 && testFiles.length === 0 && docFiles.length === 0 && specFiles.length === 0) {
      continue;
    }

    // Derive id
    const id = toModuleId(prefix);

    // Collect all topics from group
    const allTopics = new Set<string>();
    for (const f of groupFiles) {
      for (const t of f.topics) allTopics.add(t);
    }

    // Confidence calculation
    let confidence: CandidateModule["confidence"] = "low";
    const moduleSignals: string[] = [];

    if (codeFiles.length >= 2 && testFiles.length >= 1) {
      confidence = "high";
      moduleSignals.push(`multiple code files (${codeFiles.length}) + tests (${testFiles.length})`);
    } else if (codeFiles.length >= 1 && testFiles.length >= 1) {
      confidence = "medium";
      moduleSignals.push(`code (${codeFiles.length}) + test (${testFiles.length}) co-located`);
    } else if (codeFiles.length > 0) {
      confidence = "low";
      moduleSignals.push(`only code files (${codeFiles.length}), no tests`);
    } else if (docFiles.length > 0 || specFiles.length > 0) {
      confidence = "low";
      moduleSignals.push(`only docs/specs, no code`);
    }

    modules.push({
      id,
      title: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      confidence,
      topics: Array.from(allTopics),
      codeFiles,
      testFiles,
      docFiles,
      specFiles,
      demoFiles: [],
      signals: moduleSignals,
    });
  }

  // Phase 2: merge modules that share topics (e.g., registry + specs that mention registry)
  mergeRelatedModules(modules, files);

  return modules;
}

/**
 * Merge modules that share strong topic overlap — e.g., a doc/spec module
 * whose topics strongly overlap with a code module. Mutates existing modules in-place.
 */
function mergeRelatedModules(
  existing: CandidateModule[],
  allFiles: FileRecord[],
): void {
  // For now, check if spec/doc files exist that share topics with an existing
  // code module but are in a different group, and attach them.
  const specDocFiles = allFiles.filter(
    (f) => f.kind === "spec" || f.kind === "legacy" || f.kind === "doc",
  );

  for (const mod of existing) {
    // Skip modules with no code files — they can't match by path
    if (mod.codeFiles.length === 0) continue;

    const modTopics = new Set(mod.topics);
    // Compute the common path prefix of the module's code files
    // e.g., "runtime-agent-registry/internal/search" for search module
    const codePaths = mod.codeFiles.map((f) => f.toLowerCase());
    // Get the shared prefix segments of all code files
    const sharedPrefixSegs: string[] = [];
    if (codePaths.length > 0) {
      const firstSegs = codePaths[0].split("/");
      for (let i = 0; i < firstSegs.length; i++) {
        if (codePaths.every((cp) => cp.split("/")[i] === firstSegs[i])) {
          sharedPrefixSegs.push(firstSegs[i]);
        } else {
          break;
        }
      }
    }
    const sharedPrefix = sharedPrefixSegs.join("/");

    for (const file of specDocFiles) {
      if (mod.codeFiles.includes(file.path) || mod.testFiles.includes(file.path) || mod.docFiles.includes(file.path) || mod.specFiles.includes(file.path)) {
        continue;
      }

      // Check topic overlap
      const overlap = file.topics.filter((t) => modTopics.has(t));

      // Only assign if:
      // 1. Topic overlap >= 2 (stronger than just 1), OR
      // 2. Topic overlap >= 1 AND doc path shares prefix with module code path
      const docPath = file.path.toLowerCase();
      const sharesPrefix = sharedPrefix.length > 0 && docPath.startsWith(sharedPrefix);

      if ((overlap.length >= 2) || (overlap.length >= 1 && sharesPrefix)) {
        if (file.kind === "doc") {
          mod.docFiles.push(file.path);
        } else if (file.kind === "spec" || file.kind === "legacy") {
          mod.specFiles.push(file.path);
        }
        mod.signals.push(`attached ${file.kind} file "${file.path}" via shared topics: ${overlap.join(", ")}`);
      }
    }
  }
}

// ── Main entry ───────────────────────────────────────────────────────────────

export async function discoverProject(options: RepoMemoryOptions = {}): Promise<DiscoveryReport> {
  const root = resolveRoot(options);

  // Inventory files
  const rawPaths = await fg(["**/*"], {
    cwd: root,
    dot: false,
    onlyFiles: true,
    ignore: IGNORE_PATTERNS,
  });

  const records: FileRecord[] = [];

  for (const rawPath of rawPaths) {
    const relativePath = toPosixPath(rawPath);
    const absolutePath = path.join(root, rawPath);
    const statResult = await stat(absolutePath);

    const { kind, signals } = classifyFile(relativePath);
    const basename = path.basename(relativePath);
    const dirname = path.dirname(relativePath);
    const language = detectLanguage(basename);

    // Topic extraction
    const pathTopics = extractTopicsFromPath(relativePath);
    const topics = new Set(pathTopics);

    // For text files, extract more topics from content
    const ext = path.extname(basename).toLowerCase();
    if ([".go", ".ts", ".js", ".py", ".java", ".md"].includes(ext)) {
      const content = await readFile(absolutePath, "utf8");
      if (ext === ".md") {
        for (const t of extractTopicsFromMarkdownBody(content)) topics.add(t);
      } else if (ext === ".go") {
        for (const t of extractTopicsFromGoPackage(content)) topics.add(t);
      }
    }

    records.push({
      path: relativePath,
      kind,
      language,
      basename,
      dirname,
      sizeBytes: statResult.size,
      mtime: statResult.mtime.toISOString(),
      signals,
      topics: Array.from(topics),
    });
  }

  // Sort files for deterministic output
  records.sort((a, b) => a.path.localeCompare(b.path));

  const candidateModules = groupCandidateModules(records);

  const report: DiscoveryReport = {
    root,
    files: records,
    candidateModules,
  };

  // Zod-validate before returning
  return DiscoveryReportSchema.parse(report);
}
