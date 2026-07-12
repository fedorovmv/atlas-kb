import { describe, it, expect } from "vitest";
import { MemoryFrontmatterSchema } from "../src/schemas/frontmatter.js";
import {
  V3FrontmatterSchema,
  ENTITY_TYPE_MAP,
  STATUS_MAP,
  AUTHORITY_MAP,
  EVIDENCE_LEVEL_MAP,
  STABILITY_MAP,
  SOURCE_CONFIDENCE_MAP,
  KNOWLEDGE_TYPES_MAP,
  type V3Frontmatter,
} from "../src/schemas/migrateFromV3.js";
import {
  synthesizeId,
  synthesizeTitle,
  synthesizeUsagePolicy,
  synthesizeFrontmatter,
  decorateBody,
} from "../src/core/migrateSynthesis.js";

const makeV3 = (overrides: Partial<V3Frontmatter> = {}): V3Frontmatter => ({
  memory_card_type: "module",
  runtime_tier: "production",
  source_status: "current",
  evidence_level: "code",
  ...overrides,
});

describe("V3FrontmatterSchema", () => {
  it("validates known v3 frontmatter shapes", () => {
    const result = V3FrontmatterSchema.parse({
      memory_card_type: "module",
      runtime_tier: "production",
      source_status: "current",
      evidence_level: "code",
      scope: "my:scope",
      owned_paths: ["path/to/file.ts"],
      related_cards: ["card-1", "card-2"],
      language: "typescript",
      title: "My Module",
    });
    expect(result.memory_card_type).toBe("module");
    expect(result.runtime_tier).toBe("production");
    expect(result.language).toBe("typescript");
  });

  it("rejects missing memory_card_type", () => {
    expect(() =>
      V3FrontmatterSchema.parse({
        runtime_tier: "production",
        source_status: "current",
        evidence_level: "code",
      })
    ).toThrow();
  });
});

describe("ENTITY_TYPE_MAP", () => {
  it("covers all 14 v3 types, index variants map to readme", () => {
    const expected = [
      "module", "flow", "decision", "reference", "architecture", "project",
      "routing", "testing", "ops", "gotchas", "index", "module-index",
      "flow-index", "decision-index",
    ];
    for (const key of expected) {
      expect(ENTITY_TYPE_MAP[key]).toBeDefined();
    }
    expect(ENTITY_TYPE_MAP["index"]).toBe("readme");
    expect(ENTITY_TYPE_MAP["module-index"]).toBe("readme");
    expect(ENTITY_TYPE_MAP["flow-index"]).toBe("readme");
    expect(ENTITY_TYPE_MAP["decision-index"]).toBe("readme");
  });
});

describe("STATUS_MAP", () => {
  it("all 6 source_status values produce valid ts-kb-flow status", () => {
    const statuses = V3FrontmatterSchema.shape.source_status._def.values as string[];
    for (const key of statuses) {
      const mapped = STATUS_MAP[key];
      expect(mapped).toBeDefined();
      expect(["current", "proposed", "historical", "deprecated", "needs_review", "conflict"]).toContain(mapped);
    }
  });
});

describe("AUTHORITY_MAP", () => {
  it("all 8 evidence_level values produce valid authority", () => {
    const levels = V3FrontmatterSchema.shape.evidence_level._def.values as string[];
    for (const key of levels) {
      const mapped = AUTHORITY_MAP[key];
      expect(mapped).toBeDefined();
      expect(["source_of_truth", "reviewed_memory", "reference", "proposed", "historical_context", "example_only"]).toContain(mapped);
    }
  });
});

describe("EVIDENCE_LEVEL_MAP", () => {
  it("all 8 v3 evidence_level -> correct ts-kb-flow evidence_level", () => {
    const valid = ["code_confirmed", "test_confirmed", "contract_confirmed", "reviewed_doc", "heuristic_match", "spec_only", "inferred", "unknown"];
    const levels = V3FrontmatterSchema.shape.evidence_level._def.values as string[];
    for (const key of levels) {
      expect(valid).toContain(EVIDENCE_LEVEL_MAP[key]);
    }
    expect(EVIDENCE_LEVEL_MAP["code"]).toBe("code_confirmed");
    expect(EVIDENCE_LEVEL_MAP["test"]).toBe("test_confirmed");
    expect(EVIDENCE_LEVEL_MAP["config"]).toBe("contract_confirmed");
    expect(EVIDENCE_LEVEL_MAP["manifest"]).toBe("contract_confirmed");
    expect(EVIDENCE_LEVEL_MAP["current-doc"]).toBe("reviewed_doc");
    expect(EVIDENCE_LEVEL_MAP["rationale-only"]).toBe("spec_only");
    expect(EVIDENCE_LEVEL_MAP["mixed"]).toBe("inferred");
    expect(EVIDENCE_LEVEL_MAP["unknown"]).toBe("unknown");
  });
});

describe("STABILITY_MAP", () => {
  it("all 6 source_status -> correct stability", () => {
    const valid = ["stable", "evolving", "experimental", "deprecated", "unknown"];
    const statuses = V3FrontmatterSchema.shape.source_status._def.values as string[];
    for (const key of statuses) {
      expect(valid).toContain(STABILITY_MAP[key]);
    }
    expect(STABILITY_MAP["current"]).toBe("stable");
    expect(STABILITY_MAP["active-rationale"]).toBe("stable");
    expect(STABILITY_MAP["partially-active"]).toBe("evolving");
    expect(STABILITY_MAP["superseded"]).toBe("deprecated");
    expect(STABILITY_MAP["historical-only"]).toBe("deprecated");
    expect(STABILITY_MAP["unknown"]).toBe("unknown");
  });
});

describe("SOURCE_CONFIDENCE_MAP", () => {
  it("all 8 evidence_level -> correct confidence", () => {
    const valid = ["high", "medium", "low", "unknown"];
    const levels = V3FrontmatterSchema.shape.evidence_level._def.values as string[];
    for (const key of levels) {
      expect(valid).toContain(SOURCE_CONFIDENCE_MAP[key]);
    }
    expect(SOURCE_CONFIDENCE_MAP["code"]).toBe("high");
    expect(SOURCE_CONFIDENCE_MAP["test"]).toBe("high");
    expect(SOURCE_CONFIDENCE_MAP["config"]).toBe("medium");
    expect(SOURCE_CONFIDENCE_MAP["manifest"]).toBe("medium");
    expect(SOURCE_CONFIDENCE_MAP["current-doc"]).toBe("medium");
    expect(SOURCE_CONFIDENCE_MAP["rationale-only"]).toBe("low");
    expect(SOURCE_CONFIDENCE_MAP["mixed"]).toBe("low");
    expect(SOURCE_CONFIDENCE_MAP["unknown"]).toBe("unknown");
  });
});

describe("KNOWLEDGE_TYPES_MAP", () => {
  it("all 14 types -> correct knowledge_types arrays", () => {
    const expected = [
      "module", "flow", "decision", "reference", "architecture", "project",
      "routing", "testing", "ops", "gotchas", "index", "module-index",
      "flow-index", "decision-index",
    ];
    const validTypes = ["current_behavior", "proposed_behavior", "design_rationale", "historical_context", "code_evidence", "open_question", "conflict"];
    for (const key of expected) {
      const arr = KNOWLEDGE_TYPES_MAP[key];
      expect(arr).toBeDefined();
      expect(Array.isArray(arr)).toBe(true);
      for (const t of arr) {
        expect(validTypes).toContain(t);
      }
    }
    expect(KNOWLEDGE_TYPES_MAP["module"]).toEqual(["current_behavior", "code_evidence"]);
    expect(KNOWLEDGE_TYPES_MAP["decision"]).toEqual(["design_rationale", "current_behavior"]);
    expect(KNOWLEDGE_TYPES_MAP["architecture"]).toEqual(["current_behavior", "design_rationale"]);
  });
});

describe("synthesizeFrontmatter", () => {
  it("produces valid MemoryFrontmatterSchema parse", () => {
    const v3fm = makeV3();
    const usedIds = new Set<string>();
    const result = synthesizeFrontmatter(v3fm, {}, "my-module.md", usedIds);
    expect(() => MemoryFrontmatterSchema.parse(result)).not.toThrow();
  });

  it("with historical-only status prepends historical_context to knowledge_types", () => {
    const v3fm = makeV3({ source_status: "historical-only" });
    const usedIds = new Set<string>();
    const result = synthesizeFrontmatter(v3fm, {}, "my-module.md", usedIds);
    expect(result.knowledge_types[0]).toBe("historical_context");
  });

  it("with unknown memory_card_type defaults to reference", () => {
    const v3fm = makeV3({ memory_card_type: "totally_unknown" });
    const usedIds = new Set<string>();
    const result = synthesizeFrontmatter(v3fm, {}, "unknown-card.md", usedIds);
    expect(result.entity_type).toBe("reference");
  });

  it("with superseded source_status -> knowledge_types: ['historical_context']", () => {
    const v3fm = makeV3({ source_status: "superseded" });
    const usedIds = new Set<string>();
    const result = synthesizeFrontmatter(v3fm, {}, "old-card.md", usedIds);
    expect(result.knowledge_types).toEqual(["historical_context"]);
  });

  it("output has no v3 keys (memory_card_type, scope, owned_paths, related_cards, language)", () => {
    const v3fm = makeV3({ scope: "my:scope", owned_paths: ["a"], related_cards: ["b"], language: "ts" });
    const usedIds = new Set<string>();
    const result = synthesizeFrontmatter(v3fm, {}, "my-module.md", usedIds);
    const keys = Object.keys(result);
    expect(keys).not.toContain("memory_card_type");
    expect(keys).not.toContain("scope");
    expect(keys).not.toContain("owned_paths");
    expect(keys).not.toContain("related_cards");
    expect(keys).not.toContain("language");
  });
});

describe("synthesizeUsagePolicy", () => {
  it("with deprecated status sets can_answer_current_behavior=false, requires_warning=true", () => {
    const policy = synthesizeUsagePolicy("deprecated");
    expect(policy.can_answer_current_behavior).toBe(false);
    expect(policy.requires_warning).toBe(true);
  });

  it("with historical status -> can_answer_current_behavior=false, requires_warning=true", () => {
    const policy = synthesizeUsagePolicy("historical");
    expect(policy.can_answer_current_behavior).toBe(false);
    expect(policy.requires_warning).toBe(true);
  });
});

describe("decorateBody", () => {
  it("preserves language as body comment", () => {
    const body = decorateBody("# Hello", makeV3({ language: "typescript" }));
    expect(body).toContain("<!-- v3: language=typescript -->");
    expect(body).toContain("# Hello");
  });

  it("preserves v3 type for index->readme collapse", () => {
    const body = decorateBody("# Index", makeV3({ memory_card_type: "module-index" }));
    expect(body).toContain("<!-- v3: memory_card_type=module-index -->");
    expect(body).toContain("# Index");
  });
});

describe("synthesizeTitle", () => {
  it("with missing title derives from filename", () => {
    const result = synthesizeTitle(makeV3({ title: "" }), "my-super-module.md");
    expect(result).toBe("My Super Module");
  });
});

describe("synthesizeId", () => {
  it("with collision appends -1, -2", () => {
    const used = new Set<string>(["my-module", "my-module-1"]);
    const id1 = synthesizeId("my-module", used);
    expect(id1).toBe("my-module-2");
    expect(used.has("my-module-2")).toBe(true);
  });
});
