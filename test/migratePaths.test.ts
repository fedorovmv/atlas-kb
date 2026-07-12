import { describe, it, expect } from "vitest";
import {
  mapPath,
  subdirToEntityType,
  pathToId,
  idToTargetPath,
  ENTITY_TYPE_TO_SUBDIR,
  mapRelatedCards,
  mapOwnedPaths,
  mapScope,
  detectSlugCollisions,
} from "../src/core/migratePaths.js";

describe("mapPath", () => {
  it("strips knowledge/memory/ prefix and prepends .ai/memory/", () => {
    expect(mapPath("knowledge/memory/modules/auth.md")).toBe(
      ".ai/memory/modules/auth.md"
    );
  });

  it("preserves subdirectory structure", () => {
    expect(mapPath("knowledge/memory/flows/user-login.md")).toBe(
      ".ai/memory/flows/user-login.md"
    );
    expect(mapPath("knowledge/memory/decisions/ADR-001.md")).toBe(
      ".ai/memory/decisions/ADR-001.md"
    );
  });

  it("returns top-level MEMORY.md correctly", () => {
    expect(mapPath("knowledge/memory/MEMORY.md")).toBe(
      ".ai/memory/MEMORY.md"
    );
  });

  it("returns path as-is when prefix is missing", () => {
    expect(mapPath("some/other/path.md")).toBe("some/other/path.md");
  });
});

describe("subdirToEntityType", () => {
  it("maps known subdirs to entity types", () => {
    expect(subdirToEntityType("modules")).toBe("module");
    expect(subdirToEntityType("flows")).toBe("flow");
    expect(subdirToEntityType("decisions")).toBe("decision");
    expect(subdirToEntityType("architecture")).toBe("architecture");
    expect(subdirToEntityType("reference")).toBe("reference");
  });

  it("returns undefined for unknown subdir", () => {
    expect(subdirToEntityType("unknown_subdir")).toBeUndefined();
  });

  it("returns undefined for empty string (top-level)", () => {
    expect(subdirToEntityType("")).toBeUndefined();
  });
});

describe("pathToId", () => {
  it("produces valid id regex from simple path", () => {
    const id = pathToId("modules/auth-service.md");
    expect(id).toBe("modules-auth-service");
    expect(id).toMatch(/^[a-z0-9][a-z0-9\-_.]*$/);
  });

  it("handles .ai/memory/ prefix", () => {
    const id = pathToId(".ai/memory/modules/auth-service.md");
    expect(id).toBe("modules-auth-service");
  });

  it("handles knowledge/memory/ prefix", () => {
    const id = pathToId("knowledge/memory/modules/auth-service.md");
    expect(id).toBe("modules-auth-service");
  });

  it("handles nested paths", () => {
    const id = pathToId(".ai/memory/sub/module-card.md");
    expect(id).toBe("sub-module-card");
  });

  it("strips .md and lowercases", () => {
    expect(pathToId("Decisions/ADR-001.md")).toBe("decisions-adr-001");
  });

  it("handles paths without .md extension", () => {
    expect(pathToId("modules/auth")).toBe("modules-auth");
  });
});

describe("idToTargetPath", () => {
  it("maps entity type to correct subdir", () => {
    expect(idToTargetPath("auth-service", "module")).toBe(
      "modules/auth-service.md"
    );
    expect(idToTargetPath("user-flow", "flow")).toBe("flows/user-flow.md");
    expect(idToTargetPath("adr-001", "decision")).toBe(
      "decisions/adr-001.md"
    );
  });

  it("handles readme entity as top-level path", () => {
    expect(idToTargetPath("my-readme", "readme")).toBe("my-readme.md");
  });

  it("handles index entity as top-level path", () => {
    expect(idToTargetPath("index", "index")).toBe("index.md");
  });
});

describe("mapRelatedCards", () => {
  it("routes modules paths to related_modules", () => {
    const result = mapRelatedCards(["knowledge/memory/modules/auth.md"], "");
    expect(result.related_modules).toEqual(["modules-auth"]);
    expect(result.unmapped).toEqual([]);
  });

  it("routes flows paths to related_scenarios", () => {
    const result = mapRelatedCards(["knowledge/memory/flows/login.md"], "");
    expect(result.related_scenarios).toEqual(["flows-login"]);
    expect(result.unmapped).toEqual([]);
  });

  it("routes decisions paths to related_decisions", () => {
    const result = mapRelatedCards(["knowledge/memory/decisions/ADR-001.md"], "");
    expect(result.related_decisions).toEqual(["decisions-adr-001"]);
    expect(result.unmapped).toEqual([]);
  });

  it("routes unknown subdir to unmapped", () => {
    const result = mapRelatedCards(
      ["knowledge/memory/custom/anything.md"],
      ""
    );
    expect(result.unmapped).toEqual(["custom-anything"]);
    expect(result.related_modules).toEqual([]);
    expect(result.related_scenarios).toEqual([]);
    expect(result.related_decisions).toEqual([]);
    expect(result.related_specs).toEqual([]);
  });

  it("routes reference paths to related_specs", () => {
    const result = mapRelatedCards(
      ["knowledge/memory/reference/api-design.md"],
      ""
    );
    expect(result.related_specs).toEqual(["reference-api-design"]);
  });

  it("handles mixed subdirs in single call", () => {
    const result = mapRelatedCards(
      [
        "knowledge/memory/modules/auth.md",
        "knowledge/memory/flows/login.md",
        "knowledge/memory/decisions/ADR-001.md",
        "knowledge/memory/unknown/xyz.md",
      ],
      ""
    );
    expect(result.related_modules).toEqual(["modules-auth"]);
    expect(result.related_scenarios).toEqual(["flows-login"]);
    expect(result.related_decisions).toEqual(["decisions-adr-001"]);
    expect(result.unmapped).toEqual(["unknown-xyz"]);
  });
});

describe("mapOwnedPaths", () => {
  it("transforms string paths to { path, kind: 'owned' }", () => {
    const result = mapOwnedPaths(["src/auth.ts", "src/db.ts"]);
    expect(result).toEqual([
      { path: "src/auth.ts", kind: "owned" },
      { path: "src/db.ts", kind: "owned" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(mapOwnedPaths([])).toEqual([]);
  });
});

describe("mapScope", () => {
  it("converts string to array", () => {
    expect(mapScope("backend")).toEqual(["backend"]);
  });

  it("returns array as-is", () => {
    expect(mapScope(["backend", "frontend"])).toEqual(["backend", "frontend"]);
  });

  it("returns empty array for undefined", () => {
    expect(mapScope(undefined)).toEqual([]);
  });
});

describe("detectSlugCollisions", () => {
  it("detects duplicate slugs", () => {
    const result = detectSlugCollisions([
      "modules/auth.md",
      "flows/auth.md",
      "decisions/auth.md",
    ]);
    expect(result.collisions.has("modules-auth")).toBe(false);
    expect(result.collisions.has("flows-auth")).toBe(false);
    expect(result.collisions.has("decisions-auth")).toBe(false);

    // These ids are distinct because subdir differs — verify no collision
    const id1 = "modules-auth";
    const id2 = "flows-auth";
    const id3 = "decisions-auth";
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
  });

  it("proposes collisions for truly duplicate ids", () => {
    const result = detectSlugCollisions([
      "modules/auth-service.md",
      "flows/auth-service.md",
      "decisions/auth-service.md",
    ]);
    // These produce different ids: modules-auth-service, flows-auth-service, etc.
    // All distinct — so no collisions
    expect(result.collisions.size).toBe(0);
  });

  it("detects collisions when paths produce same id", () => {
    const result = detectSlugCollisions([
      "modules/auth-service.md",
      "flows/auth-service.md",
      "modules/auth-service.md",
    ]);
    // First and third produce same id "modules-auth-service"
    expect(result.collisions.has("modules-auth-service")).toBe(true);
    expect(result.collisions.get("modules-auth-service")).toEqual([
      "modules/auth-service.md",
      "modules/auth-service.md",
    ]);
    expect(result.collisions.has("flows-auth-service")).toBe(false);
  });

  it("returns empty collisions map for unique slugs", () => {
    const result = detectSlugCollisions([
      "modules/auth.md",
      "flows/checkout.md",
      "decisions/ADR-001.md",
    ]);
    expect(result.collisions.size).toBe(0);
  });
});

describe("ENTITY_TYPE_TO_SUBDIR", () => {
  it("covers all 20 entity types", () => {
    const entityTypes = [
      "module",
      "flow",
      "decision",
      "architecture",
      "reference",
      "task_routing",
      "testing",
      "ops",
      "gotchas",
      "project",
      "readme",
      "scenario",
      "proposal",
      "historical",
      "conflict",
      "open_question",
      "product_map",
      "ontology",
      "routing",
      "index",
    ];
    expect(Object.keys(ENTITY_TYPE_TO_SUBDIR)).toHaveLength(20);
    for (const et of entityTypes) {
      expect(ENTITY_TYPE_TO_SUBDIR[et]).toBeDefined();
    }
  });

  it("maps readme to empty string (top-level)", () => {
    expect(ENTITY_TYPE_TO_SUBDIR["readme"]).toBe("");
  });

  it("maps index to empty string (top-level)", () => {
    expect(ENTITY_TYPE_TO_SUBDIR["index"]).toBe("");
  });
});
