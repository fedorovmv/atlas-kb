import { z } from "zod";
import type { EntityType } from "../schemas/frontmatter.js";

export interface SectionContract {
  required: string[];   // mandatory sections (H2 headings)
  recommended?: string[]; // recommended sections (warning, not error)
}

export const CARD_SECTION_CONTRACTS: Record<EntityType, SectionContract> = {
  module: {
    required: [
      "## Responsibilities",
      "## Non-responsibilities",
      "## Current behavior",
      "## Related scenarios",
      "## Related decisions",
      "## Code references",
      "## Test references",
      "## Known risks",
      "## Open questions",
      "## Why these boundaries",
    ],
    recommended: [
      "## Public surface",
      "## Dependencies",
    ],
  },
  flow: {
    required: [
      "## Goal",
      "## Actors",
      "## Sequence",
      "## Fallback",
      "## Constraints",
      "## Error handling",
      "## Related modules",
      "## Related tests",
      "## Rationale",
    ],
    recommended: ["## State transitions"],
  },
  decision: {
    required: [
      "## Context",
      "## Problem",
      "## Decision",
      "## Rationale",
      "## Alternatives considered",
      "## Rejected alternatives",
      "## Consequences",
      "## Current behavior evidence",
      "## Affected modules",
      "## Affected scenarios",
    ],
  },
  scenario: {
    required: [
      "## Goal",
      "## Actors",
      "## Flow",
      "## Constraints",
      "## Error cases",
      "## Related modules",
      "## Related tests",
      "## Rationale",
    ],
  },
  proposal: {
    required: [
      "## Source spec",
      "## Proposed behavior",
      "## Rationale from spec",
      "## Affected modules",
      "## Affected scenarios",
      "## Affected decisions",
      "## Current code check",
      "## Claims",
      "## Review decision",
    ],
  },
  historical: {
    required: [
      "## What problem was being solved",
      "## Rationale still useful",
      "## Obsolete ideas",
      "## Decisions that survived",
      "## Links to current decisions",
    ],
  },
  reference: {
    required: [
      "## Behaviors carried over",
      "## Behaviors intentionally not carried over",
      "## Invariants and state transitions",
      "## Failure/retry/cancellation/recovery",
      "## Compatibility/operational constraints",
      "## Derived scenarios and tests",
    ],
  },
  testing: {
    required: [
      "## Test layers",
      "## Commands",
      "## Coverage",
      "## Known gaps",
    ],
  },
  ops: {
    required: [
      "## Deployment",
      "## Configuration",
      "## Diagnostics",
    ],
  },
  gotchas: {
    required: [
      "## Pitfall",
      "## Avoidance",
      "## Evidence",
    ],
  },
  architecture: {
    required: [
      "## Architecture overview",
    ],
    recommended: [
      "## Components",
      "## Dependencies",
      "## Data flow",
    ],
  },
  // Types without required sections (index, product_map, ontology, readme, conflict, open_question, task_routing, project, routing)
  index: { required: [] },
  product_map: { required: [] },
  ontology: { required: [] },
  readme: { required: [] },
  conflict: { required: [] },
  open_question: { required: [] },
  task_routing: { required: [] },
  project: { required: [] },
  routing: { required: [] },
};

export const CardSectionContractSchema = z.object({
  required: z.array(z.string()),
  recommended: z.array(z.string()).optional(),
});
