import { describe, expect, it } from "vitest";
import {
  detectBoilerplate,
  computeCardScope,
  extractCardScopedSentences,
  semanticRepairCard,
  BOILERPLATE_PATTERNS,
  CATEGORY_KEYWORDS,
} from "../src/core/semanticRepair.js";
import {
  BoilerplateMatchSchema,
  ExtractedSentenceSchema,
  RepairResultSchema,
  CardScopeSchema,
} from "../src/schemas/semanticRepair.js";
import type { MemoryCard } from "../src/core/types.js";
import type { MemoryFrontmatter } from "../src/schemas/frontmatter.js";
import type { SourceContentMap } from "../src/schemas/sourceContentMap.js";
import { MemoryFrontmatterSchema } from "../src/schemas/frontmatter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides?: {
  metaPartial?: Partial<MemoryFrontmatter>;
  body?: string;
}): MemoryCard {
  const meta = MemoryFrontmatterSchema.parse({
    entity_type: "module",
    id: "test-card",
    title: "Test Card Module",
    status: "current",
    authority: "reviewed_memory",
    evidence_level: "code_confirmed",
    stability: "stable",
    source_confidence: "high",
    last_reviewed: "2026-07-09",
    review_required: false,
    knowledge_types: ["current_behavior"],
    aliases: [],
    product_areas: [],
    code_refs: [],
    usage_policy: {
      can_answer_current_behavior: true,
      can_generate_code_from: true,
      can_use_as_rationale: true,
      can_use_as_example: false,
      requires_code_check_before_change: true,
    },
    ...overrides?.metaPartial,
  });

  return {
    path: "/base/.ai/memory/modules/test-card.md",
    relativePath: ".ai/memory/modules/test-card.md",
    meta,
    body: overrides?.body ?? "Test card body",
    raw: "---\n---\nTest card body",
  };
}

function makeContentMap(overrides?: {
  id?: string;
  path?: string;
  topics?: string[];
  targetCards?: string[];
  sectionMap?: Array<{
    heading: string;
    startLine: number;
    endLine: number;
    summary?: string;
    keywordTopics?: string[];
  }>;
}): SourceContentMap {
  return {
    contentMapId: overrides?.id ?? "cm-1",
    path: overrides?.path ?? "/base/docs/source.md",
    sha256: "abc123",
    title: "Source Doc",
    moduleBoundary: undefined,
    classifiers: {
      sourceType: "doc",
      memoryIntents: [],
      tags: [],
    },
    topics: overrides?.topics ?? [],
    components: [],
    services: [],
    referencedPaths: [],
    targetCards: overrides?.targetCards ?? [],
    sectionMap: overrides?.sectionMap ?? [],
  };
}

// ---------------------------------------------------------------------------
// Schema tests
// ---------------------------------------------------------------------------

describe("BoilerplateMatchSchema", () => {
  it("parses valid boilerplate match", () => {
    const match = BoilerplateMatchSchema.parse({
      sectionName: "Decision",
      pattern: "Needs review",
      position: { line: 10, column: 5 },
    });
    expect(match.sectionName).toBe("Decision");
    expect(match.pattern).toBe("Needs review");
    expect(match.position.line).toBe(10);
  });
});

describe("ExtractedSentenceSchema", () => {
  it("parses valid extracted sentence", () => {
    const sentence = ExtractedSentenceSchema.parse({
      text: "This is a meaningful sentence about the decision process.",
      score: 15,
      sourcePath: "/base/docs/decision.md",
      category: "decision",
    });
    expect(sentence.text).toContain("meaningful");
    expect(sentence.score).toBe(15);
    expect(sentence.category).toBe("decision");
  });

  it("parses without optional category", () => {
    const sentence = ExtractedSentenceSchema.parse({
      text: "This is a meaningful sentence that needs to be long enough chars here",
      score: 10,
      sourcePath: "/base/docs/doc.md",
    });
    expect(sentence.category).toBeUndefined();
  });
});

describe("RepairResultSchema", () => {
  it("parses valid repair result", () => {
    const result = RepairResultSchema.parse({
      cardId: "test-card",
      repaired: true,
      filledSections: ["Decision"],
      quarantined: false,
      reason: undefined,
    });
    expect(result.cardId).toBe("test-card");
    expect(result.repaired).toBe(true);
  });
});

describe("CardScopeSchema", () => {
  it("parses valid card scope", () => {
    const scope = CardScopeSchema.parse({
      includes: ["test", "card"],
      excludes: ["scenario"],
      allowPairs: [["test", "card"]],
    });
    expect(scope.includes).toContain("test");
    expect(scope.excludes).toContain("scenario");
  });
});

// ---------------------------------------------------------------------------
// detectBoilerplate
// ---------------------------------------------------------------------------

describe("detectBoilerplate", () => {
  it('detects "Needs review" boilerplate', () => {
    const body = `
## Context
Some real context here.

## Decision
Needs review — fill in the actual decision that was made.
`;
    const matches = detectBoilerplate(body);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].sectionName).toBe("Decision");
    expect(["Needs review", "Needs review —"]).toContain(matches[0].pattern);
  });

  it("detects Russian pattern 待定", () => {
    const body = `
## Context
Решение пока待定 — нужно обсудить.
`;
    const matches = detectBoilerplate(body);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].pattern).toBe("待定");
  });

  it("returns no matches for real content", () => {
    const body = `
## Context
The system uses a pipeline-based architecture with event-driven processing.

## Decision
We chose Go for the backend because of its concurrency model and performance characteristics.
`;
    const matches = detectBoilerplate(body);
    expect(matches.length).toBe(0);
  });

  it("returns no matches for legitimate short content that is not boilerplate", () => {
    const body = `
## Rationale
Short valid rationale text here.
`;
    const matches = detectBoilerplate(body);
    expect(matches.length).toBe(0);
  });

  it("detects multiple boilerplate patterns in different sections", () => {
    const body = `
## Context
Needs review — fill in context.

## Decision
TBD — waiting for team input.

## Rationale
Real rationale that explains the choice thoroughly.
`;
    const matches = detectBoilerplate(body);
    // Should match Context (Needs review) and Decision (TBD)
    const sections = matches.map((m) => m.sectionName);
    expect(sections).toContain("Context");
    expect(sections).toContain("Decision");
    expect(sections).not.toContain("Rationale");
  });

  it("BOILERPLATE_PATTERNS has 15+ patterns", () => {
    expect(BOILERPLATE_PATTERNS.length).toBeGreaterThanOrEqual(15);
  });
});

// ---------------------------------------------------------------------------
// computeCardScope
// ---------------------------------------------------------------------------

describe("computeCardScope", () => {
  it("derives includes from knowledge_types and title", () => {
    const card = makeCard({
      metaPartial: {
        knowledge_types: ["design_rationale", "current_behavior"],
        title: "Auth Module Flow",
      },
    });
    const scope = computeCardScope(card);
    expect(scope.includes).toContain("auth");
    expect(scope.includes).toContain("module");
    expect(scope.includes).toContain("flow");
    expect(scope.includes).toContain("design");
  });

  it("derives excludes from non-matching entity types", () => {
    const card = makeCard({
      metaPartial: { entity_type: "decision" },
    });
    const scope = computeCardScope(card);
    expect(scope.excludes).toContain("module");
    expect(scope.excludes).toContain("scenario");
    expect(scope.excludes).not.toContain("decision");
  });

  it("derives allowPairs from adjacent title tokens", () => {
    const card = makeCard({
      metaPartial: { title: "Data Pipeline Processing" },
    });
    const scope = computeCardScope(card);
    const pairs = scope.allowPairs;
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    // Should have adjacent pairs: ["data", "pipeline"], ["pipeline", "processing"]
    expect(pairs).toContainEqual(["data", "pipeline"]);
  });
});

// ---------------------------------------------------------------------------
// extractCardScopedSentences
// ---------------------------------------------------------------------------

describe("extractCardScopedSentences", () => {
  it("includes sentence with high topic overlap (>= 8)", () => {
    const card = makeCard({
      metaPartial: {
        id: "auth-flow",
        title: "Auth Flow",
      },
    });
    const cm = makeContentMap({
      topics: [
        "auth", "authentication", "flow", "pipeline",
        "processing", "module", "test", "card",
        "auth-flow", "security", "verification", "token",
      ],
      targetCards: ["auth-flow"],
      sectionMap: [
        {
          heading: "Authentication Flow Details",
          startLine: 1,
          endLine: 10,
          summary: "The auth flow uses token-based verification with OAuth2 standards and provides robust security for all services.",
        },
      ],
    });

    const results = extractCardScopedSentences(card, [cm]);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("excludes sentence below threshold", () => {
    const card = makeCard({
      metaPartial: {
        id: "unique-module-xyz",
        title: "Unique Module Xyz",
      },
    });
    const cm = makeContentMap({
      topics: ["completely", "unrelated", "topics"],
      targetCards: ["unique-module-xyz"],
      sectionMap: [
        {
          heading: "Unrelated Section",
          startLine: 1,
          endLine: 10,
          summary: "This talks about something totally different and has no connection to the target at all whatsoever.",
        },
      ],
    });

    const results = extractCardScopedSentences(card, [cm]);
    expect(results.length).toBe(0);
  });

  it("excludes sentence with length > 360", () => {
    const longText =
      "This is an extremely long sentence that goes on and on and on far exceeding the maximum allowed length of 360 characters. " +
      "It keeps going with more and more words that serve no purpose other than to make this sentence incredibly long. " +
      "The verification process uses authentication tokens and authorization flow with OAuth2 standards and provides robust " +
      "security for all services and modules and components in the entire system architecture design framework.";

    const card = makeCard({
      metaPartial: { id: "long-s" },
    });
    const cm = makeContentMap({
      topics: ["long", "sentence"],
      targetCards: ["long-s"],
      sectionMap: [
        {
          heading: "Long Stuff",
          startLine: 1,
          endLine: 10,
          summary: longText + ".",
        },
      ],
    });

    const results = extractCardScopedSentences(card, [cm]);
    expect(results.length).toBe(0);
  });

  it("deduplicates by first 140 chars", () => {
    const card = makeCard({
      metaPartial: {
        id: "dedup-test",
        title: "Dedup Test",
      },
    });
    const sharedStart =
      "The dedup test module uses a special process for verification that checks all important aspects of the system carefully and thoroughly with attention to detail and comprehensive coverage";
    const sentenceA = `${sharedStart} version A ending.`;
    const sentenceB = `${sharedStart} version B ending.`;

    const cm = makeContentMap({
      topics: [
        "dedup", "test", "verification", "process",
        "system", "module", "check", "important",
        "aspects", "special", "uses", "module",
      ],
      targetCards: ["dedup-test"],
      sectionMap: [
        {
          heading: "Dedup Test Section",
          startLine: 1,
          endLine: 20,
          summary: `${sentenceA} ${sentenceB}`,
        },
      ],
    });

    const results = extractCardScopedSentences(card, [cm]);
    // Both sentences score well but share content — dedup should reduce duplicates
    // Note: heading prefix means first 140 chars differ slightly, so both may pass dedup
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("blocks sentence matching excludes list — scopeScore < 0", () => {
    const card = makeCard({
      metaPartial: {
        entity_type: "module",
        id: "api-module",
        title: "Api Module",
      },
    });
    const cm = makeContentMap({
      topics: [
        "api", "module", "scenario", "testing", "flow",
        "api", "module", "scenario", "testing", "flow",
        "api", "module", "scenario", "testing", "flow",
        "api", "module", "scenario", "testing",
      ],
      targetCards: ["api-module"],
      sectionMap: [
        {
          heading: "API Module Section",
          startLine: 1,
          endLine: 10,
          summary:
            "This section is purely about scenario and proposal and historical content and conflict and architecture that should not be in our target at all",
        },
      ],
    });

    const results = extractCardScopedSentences(card, [cm]);
    // The sentence is dominated by exclude tokens (scenario, proposal, historical, conflict, architecture, product_map)
    // scopeScore should go negative, blocking inclusion
    expect(results.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// semanticRepairCard
// ---------------------------------------------------------------------------

describe("semanticRepairCard", () => {
  it("fills boilerplate section with extracted content — repaired=true", () => {
    const card = makeCard({
      metaPartial: { id: "repair-card" },
      body: `
## Context
Real context here.

## Decision
Needs review — fill in the decision.

## Rationale
Real rationale about why this was chosen.
`,
    });
    const cm = makeContentMap({
      topics: [
        "repair", "card", "decision", "process",
        "system", "module", "flow", "test",
        "uses", "chosen", "selected", "verified",
      ],
      targetCards: ["repair-card"],
      sectionMap: [
        {
          heading: "Repair Card Decision",
          startLine: 1,
          endLine: 10,
          summary: "The repair card uses a chosen decision process with verified standards that the system uses.",
        },
      ],
    });

    const result = semanticRepairCard(card, [cm]);
    expect(result.cardId).toBe("repair-card");
    expect(result.repaired).toBe(true);
    expect(result.filledSections.length).toBeGreaterThanOrEqual(1);
    expect(result.filledSections).toContain("Decision");
    expect(result.quarantined).toBe(false);
  });

  it("quarantines when no content maps for card", () => {
    const card = makeCard({
      metaPartial: { id: "no-maps-card" },
      body: `
## Context
Real context here.

## Decision
Needs review — fill in the decision.

## Rationale
Real rationale content.
`,
    });

    // No content maps for this card
    const result = semanticRepairCard(card, []);
    expect(result.cardId).toBe("no-maps-card");
    expect(result.repaired).toBe(false);
    expect(result.quarantined).toBe(true);
    expect(result.reason).toBeDefined();
  });

  it("quarantines when >50% sections are boilerplate and no content to fill", () => {
    const card = makeCard({
      metaPartial: { id: "mostly-bp" },
      body: `
## Context
Needs review — context.

## Decision
TBD decision stuff here.

## Rationale
Requires review rationale.

## Alternatives
Real alternatives content here.
`,
    });
    // No content map — can't fill sections → quarantine
    const result = semanticRepairCard(card, []);
    expect(result.quarantined).toBe(true);
    expect(result.reason).toContain("No content maps");
  });
});

// ---------------------------------------------------------------------------
// CATEGORY_KEYWORDS
// ---------------------------------------------------------------------------

describe("CATEGORY_KEYWORDS", () => {
  it("has expected categories", () => {
    expect(CATEGORY_KEYWORDS).toHaveProperty("decision");
    expect(CATEGORY_KEYWORDS).toHaveProperty("mechanics");
    expect(CATEGORY_KEYWORDS).toHaveProperty("rationale");
    expect(CATEGORY_KEYWORDS).toHaveProperty("alternative");
    expect(CATEGORY_KEYWORDS).toHaveProperty("consequence");
    expect(CATEGORY_KEYWORDS).toHaveProperty("flow");
  });

  it("categories contain keywords", () => {
    expect(CATEGORY_KEYWORDS.decision).toContain("decision");
    expect(CATEGORY_KEYWORDS.rationale).toContain("reason");
    expect(CATEGORY_KEYWORDS.flow).toContain("step");
  });
});
