/**
 * Path mapping and structural transforms for v3 → v4 migration.
 *
 * Converts legacy `knowledge/memory/*` paths into the new `.ai/memory/*` layout,
 * deriving entity types from subdirectory names and generating stable ids.
 */

const V3_PREFIX = "knowledge/memory/";

const ENTITY_TYPE_TO_SUBDIR: Record<string, string> = {
  module: "modules",
  flow: "flows",
  decision: "decisions",
  architecture: "architecture",
  reference: "reference",
  task_routing: "routing",
  testing: "testing",
  ops: "ops",
  gotchas: "gotchas",
  project: "project",
  readme: "",
  scenario: "scenarios",
  proposal: "proposals",
  historical: "historical",
  conflict: "conflicts",
  open_question: "questions",
  product_map: "maps",
  ontology: "ontology",
  routing: "routing",
  index: "",
};

const SUBDIR_TO_ENTITY_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ENTITY_TYPE_TO_SUBDIR)
    .filter(([_, v]) => v !== "")
    .map(([k, v]) => [v, k])
    .filter(([, v]) => v !== undefined)
);

function extractSubdir(relativePath: string): string | undefined {
  const segments = relativePath.split("/");
  if (segments.length < 2) return undefined;
  if (segments[0] === "") return undefined;
  return segments[0];
}

/**
 * Strip `knowledge/memory/` prefix, prepend `.ai/memory/`.
 * If the path doesn't start with `knowledge/memory/`, return as-is.
 */
export function mapPath(v3RelativePath: string): string {
  if (v3RelativePath.startsWith(V3_PREFIX)) {
    return ".ai/memory/" + v3RelativePath.slice(V3_PREFIX.length);
  }
  return v3RelativePath;
}

/**
 * Map a subdirectory name (e.g. "modules") to an entity type (e.g. "module").
 * Returns undefined for top-level (no subdir) or unknown subdirs.
 */
export function subdirToEntityType(subdir: string): string | undefined {
  return SUBDIR_TO_ENTITY_TYPE[subdir] ?? undefined;
}

/**
 * Generate a stable id from a path.
 *
 * Strips any prefix to get the relative name, removes `.md`, replaces `/` with `-`,
 * and lowercases the result. Outputs must match `/^[a-z0-9][a-z0-9\-_.]*$/`.
 */
export function pathToId(relativePath: string): string {
  let name = relativePath;

  // Strip known prefixes to isolate the filename portion
  const prefixes = [".ai/memory/", "knowledge/memory/"];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }

  // Remove .md extension if present
  if (name.endsWith(".md")) {
    name = name.slice(0, -3);
  }

  // Replace path separators with hyphens, lowercase
  let id = name.replace(/\//g, "-").toLowerCase();

  // Ensure first char satisfies the id regex: must be [a-z0-9]
  if (id.length > 0 && !/^[a-z0-9]/.test(id[0])) {
    id = id.replace(/^[^a-z0-9]+/, "");
  }

  return id;
}

/**
 * Given an id and entity_type, determine the target file path relative to `.ai/memory/`.
 *
 * Example: id="modules-auth-service", entityType="module" → "modules/auth-service.md"
 */
export function idToTargetPath(id: string, entityType: string): string {
  const subdir = ENTITY_TYPE_TO_SUBDIR[entityType] ?? "modules";
  if (!subdir) {
    // Top-level entities (readme, index)
    return id + ".md";
  }
  return subdir + "/" + id + ".md";
}

/**
 * Map an array of v3 relative card paths into the new related-fields structure.
 *
 * Routes paths based on their subdirectory:
 *   modules → related_modules
 *   flows   → related_scenarios
 *   decisions → related_decisions
 *   reference → related_specs
 *   unknown → unmapped
 */
export function mapRelatedCards(
  relatedCards: string[],
  _v3Dir: string
): {
  related_modules: string[];
  related_scenarios: string[];
  related_decisions: string[];
  related_specs: string[];
  unmapped: string[];
} {
  const result = {
    related_modules: [] as string[],
    related_scenarios: [] as string[],
    related_decisions: [] as string[],
    related_specs: [] as string[],
    unmapped: [] as string[],
  };

  const subdirRoute: Record<string, keyof typeof result> = {
    modules: "related_modules",
    flows: "related_scenarios",
    decisions: "related_decisions",
    reference: "related_specs",
  };

  for (const cardPath of relatedCards) {
    // Normalize path so extractSubdir sees the actual subdir
    let normalized = cardPath;
    if (normalized.startsWith(V3_PREFIX)) {
      normalized = normalized.slice(V3_PREFIX.length);
    } else if (normalized.startsWith(".ai/memory/")) {
      normalized = normalized.slice(".ai/memory/".length);
    }
    const subdir = extractSubdir(normalized);
    const id = pathToId(cardPath);

    if (subdir && subdirRoute[subdir]) {
      result[subdirRoute[subdir]].push(id);
    } else {
      result.unmapped.push(id);
    }
  }

  return result;
}

/**
 * Map an array of owned path strings to RefSchema-compatible objects.
 */
export function mapOwnedPaths(
  ownedPaths: string[]
): Array<{ path: string; kind: string }> {
  return ownedPaths.map((p) => ({ path: p, kind: "owned" }));
}

/**
 * Normalize scope field which can be string, string[], or undefined.
 */
export function mapScope(scope: string | string[] | undefined): string[] {
  if (scope === undefined) return [];
  if (typeof scope === "string") return [scope];
  return scope;
}

/**
 * Detect duplicate slugs that would collide on migration.
 *
 * Returns a Map where keys are the colliding slug and values are the
 * original paths that produced that slug. Empty map means no collisions.
 *
 * The caller can use this to propose -1, -2, etc. suffixes for resolution.
 */
export function detectSlugCollisions(paths: string[]): {
  collisions: Map<string, string[]>;
} {
  const slugToPaths = new Map<string, string[]>();

  for (const p of paths) {
    const slug = pathToId(p);
    const existing = slugToPaths.get(slug) ?? [];
    existing.push(p);
    slugToPaths.set(slug, existing);
  }

  const collisions = new Map<string, string[]>();
  for (const [slug, originalPaths] of slugToPaths) {
    if (originalPaths.length > 1) {
      collisions.set(slug, originalPaths);
    }
  }

  return { collisions };
}

export { ENTITY_TYPE_TO_SUBDIR };
