export type ScaffoldFile = { path: string; content: string };

export const scaffoldFiles: ScaffoldFile[] = [
  {
    path: ".ai/memory/README.md",
    content: `---
entity_type: readme
id: memory-readme
title: Memory Bank README
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
product_areas: []
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Project Memory Bank

Read this first before using repository memory.

## Required reading order

1. \`.ai/memory/README.md\`
2. \`.ai/memory/ontology.md\`
3. Relevant module cards
4. Relevant scenario cards
5. Relevant decision cards
6. Proposals and historical cards only when needed

## Source priority

1. Current code
2. Current tests
3. API contracts / schemas
4. Reviewed memory
5. Current docs
6. Reviewed specs
7. New specs
8. Historical specs
9. Demo modules

## Critical rules

- A new spec is proposed behavior, not current behavior.
- Historical specs may preserve rationale but must not override current code.
- Demo code is example-only unless explicitly marked otherwise.
- Do not implement from rationale alone.
- If sources conflict, record the conflict instead of silently resolving it.
`,
  },
  {
    path: ".ai/memory/ontology.md",
    content: `---
entity_type: ontology
id: memory-ontology
title: Memory Ontology
status: current
authority: source_of_truth
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
product_areas: []
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Memory Ontology

The memory bank is not a document archive. It is the current engineering understanding of the product, including behavior, rationale, historical context, proposals, conflicts, and open questions.

## Knowledge types

| Type | Meaning | Can update current behavior? |
|---|---|---|
| current_behavior | Confirmed actual behavior | yes, only with evidence |
| proposed_behavior | Described by a new spec, not confirmed yet | no |
| design_rationale | Why a decision was made | no, but can constrain changes |
| historical_context | Old specs and previous assumptions | no |
| code_evidence | Code/test/contract confirmation | yes |
| open_question | Something unresolved | no |
| conflict | Contradiction between sources | no |

## Entity types

- product_map
- architecture
- module
- scenario
- decision
- proposal
- historical
- conflict
- open_question

## Core relation types

- affects
- implements
- tests
- documents
- motivates
- proposes
- rejects
- conflicts_with
- supersedes

## Current behavior rule

Current behavior must be confirmed by code, tests, contracts, or explicit review. Specs and rationale alone are not enough.
`,
  },
  {
    path: ".ai/memory/product-map.md",
    content: `---
entity_type: product_map
id: product-map
title: Product Map
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
product_areas:
  - api-mesh
  - ai-runtime
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Product Map

## Product

Synapse API Mesh.

## Main product areas

- API Mesh Runtime
- Agent & Tool Registry
- MCP Gateway
- A2A agent discovery
- Policies and access control
- Observability
- Developer tooling

## Non-goals

- Business orchestration of agents
- Choosing the best agent for a task
- Prompt engineering for application agents
`,
  },
  {
    path: ".ai/memory/modules/agent-tool-registry.md",
    content: `---
entity_type: module
id: agent-tool-registry
title: Agent & Tool Registry
status: current
authority: reviewed_memory
evidence_level: code_confirmed
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
product_areas:
  - api-mesh
  - ai-runtime
aliases:
  - agent registry
  - tool registry
  - agent card registry
  - реестр агентских карточек
related_modules:
  - mcp-gateway
related_scenarios:
  - a2a-agent-discovery
related_decisions:
  - registry-is-discovery-not-orchestration
code_refs:
  - path: internal/registry
    kind: production
  - path: pkg/agentcard
    kind: production
test_refs:
  - path: tests/agent-registry
    kind: integration
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Agent & Tool Registry

## Current responsibility

Registry stores and exposes agent/tool metadata for discovery and filters availability according to service identity and access policy.

## Not responsible for

- Choosing the target agent
- Business orchestration
- Runtime execution of target calls

## Current behavior

Calling agents use discovery metadata to find available targets. Runtime calls are performed through the mesh/runtime path, not by the registry itself.

## Why this boundary exists

Registry remains a discovery component to avoid mixing metadata storage, target selection, and runtime orchestration.

## Related code

- \`internal/registry\`
- \`pkg/agentcard\`

## Related tests

- \`tests/agent-registry\`

## Open questions

- Which checks belong to discovery time and which belong to runtime time?
`,
  },
  {
    path: ".ai/memory/modules/mcp-gateway.md",
    content: `---
entity_type: module
id: mcp-gateway
title: MCP Gateway
status: needs_review
authority: reviewed_memory
evidence_level: unknown
stability: evolving
source_confidence: low
last_reviewed: 2026-07-08
review_required: true
knowledge_types:
  - current_behavior
  - design_rationale
product_areas:
  - api-mesh
  - ai-runtime
aliases:
  - mcp gateway
  - mcp tools
  - mcp server
related_modules:
  - agent-tool-registry
related_scenarios:
  - mcp-tool-discovery
related_decisions:
  - registry-is-discovery-not-orchestration
code_refs:
  - path: internal/mcp
    kind: production
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# MCP Gateway

## Current responsibility

TBD. Fill this after checking current code and product documentation.

## Why this boundary exists

TBD.
`,
  },
  {
    path: ".ai/memory/scenarios/a2a-agent-discovery.md",
    content: `---
entity_type: scenario
id: a2a-agent-discovery
title: A2A Agent Discovery
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - current_behavior
  - design_rationale
product_areas:
  - ai-runtime
aliases:
  - agent discovery
  - agent card discovery
  - a2a discovery
related_modules:
  - agent-tool-registry
related_decisions:
  - registry-is-discovery-not-orchestration
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Scenario: A2A Agent Discovery

## Goal

A calling agent discovers available agent cards before invoking a target service through the mesh.

## Flow

1. Calling agent requests available agent cards.
2. Registry filters cards according to caller identity and policies.
3. Calling agent receives available cards.
4. Calling agent invokes the selected target service through mesh/runtime.

## Constraints

- Registry does not choose the target agent.
- Registry does not execute target calls.
- Historical specs cannot override current runtime behavior.
`,
  },

  {
    path: ".ai/memory/scenarios/mcp-tool-discovery.md",
    content: `---
entity_type: scenario
id: mcp-tool-discovery
title: MCP Tool Discovery
status: needs_review
authority: reviewed_memory
evidence_level: unknown
stability: evolving
source_confidence: low
last_reviewed: 2026-07-08
review_required: true
knowledge_types:
  - current_behavior
  - design_rationale
product_areas:
  - ai-runtime
aliases:
  - mcp discovery
  - tool discovery
related_modules:
  - mcp-gateway
  - agent-tool-registry
related_decisions:
  - registry-is-discovery-not-orchestration
usage_policy:
  can_answer_current_behavior: true
  can_generate_code_from: true
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Scenario: MCP Tool Discovery

## Goal

TBD. Fill this after checking current MCP Gateway code and specs.

## Open questions

- Should MCP tools and A2A agent cards share one metadata envelope?
`,
  },
  {
    path: ".ai/memory/decisions/registry-is-discovery-not-orchestration.md",
    content: `---
entity_type: decision
id: registry-is-discovery-not-orchestration
title: Registry is discovery, not orchestration
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: stable
source_confidence: high
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - design_rationale
  - current_behavior
product_areas:
  - api-mesh
  - ai-runtime
affects_modules:
  - agent-tool-registry
affects_scenarios:
  - a2a-agent-discovery
related_modules:
  - agent-tool-registry
related_scenarios:
  - a2a-agent-discovery
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Decision: Registry is discovery, not orchestration

## Context

The product needs a way for agents and tools to discover available metadata inside Synapse API Mesh.

## Problem

If registry responsibilities are not explicit, it can be mistaken for a runtime orchestrator that chooses agents or executes calls.

## Decision

Registry is a discovery component. It stores and exposes metadata and access-filtered availability. It does not choose target agents and does not execute runtime calls.

## Rationale

This boundary keeps the component simple and avoids mixing metadata discovery, business decisions, and runtime execution.

## Alternatives considered

### Registry as runtime orchestrator

Status: rejected.

Reason: this mixes discovery and runtime responsibilities and creates incorrect expectations about the registry.

## Consequences

- Agent selection remains outside registry.
- Runtime checks must be described separately.
- Code changes around registry must preserve this boundary unless a new decision supersedes it.
`,
  },
  {
    path: ".ai/memory/proposals/.gitkeep",
    content: "",
  },
  {
    path: ".ai/memory/reconciliation/conflicts.md",
    content: `---
entity_type: conflict
id: memory-conflicts
title: Memory / Code Conflicts
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - conflict
product_areas: []
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Memory / Code Conflicts

Record unresolved contradictions between memory, specs, docs, code, and tests here.
`,
  },
  {
    path: ".ai/memory/reconciliation/open-questions.md",
    content: `---
entity_type: open_question
id: memory-open-questions
title: Open Questions
status: current
authority: reviewed_memory
evidence_level: reviewed_doc
stability: evolving
source_confidence: medium
last_reviewed: 2026-07-08
review_required: false
knowledge_types:
  - open_question
product_areas: []
usage_policy:
  can_answer_current_behavior: false
  can_generate_code_from: false
  can_use_as_rationale: true
  can_use_as_example: false
  requires_code_check_before_change: true
---

# Open Questions

Record unresolved questions here instead of letting the agent invent answers.
`,
  },
  {
    path: ".ai/memory-tool/config/source-priority.yaml",
    content: `priority:
  - current-code
  - current-tests
  - api-contracts
  - reviewed-memory
  - current-docs
  - reviewed-specs
  - new-specs
  - historical-specs
  - demo-modules
rules:
  - New specs describe proposed behavior, not current behavior.
  - Historical specs may preserve rationale but must not override current code.
  - Demo modules are examples, not production evidence.
  - If code and memory conflict, write conflict instead of silently updating memory.
  - If rationale is inferred, mark it as inferred.
`,
  },
  {
    path: ".ai/memory-tool/config/model-routing.yaml",
    content: `models:
  extractor:
    provider_model: qwen-3.6-27b
    purpose: cheap structured extraction and classification
  coder:
    provider_model: qwen-coder-next
    purpose: codebase search, code evidence, tests, markdown patches
  reviewer:
    provider_model: qwen-thinking-large
    purpose: rationale, conflicts, design decisions, final review
routing:
  document_classification: extractor
  fact_extraction: extractor
  rationale_extraction: reviewer
  code_evidence_check: coder
  memory_patch_generation: coder
  conflict_resolution: reviewer
  final_review: reviewer
`,
  },
  {
    path: ".ai/memory-tool/config/code-map.yaml",
    content: `modules:
  agent-tool-registry:
    title: Agent & Tool Registry
    memory_file: .ai/memory/modules/agent-tool-registry.md
    aliases:
      - agent registry
      - tool registry
      - реестр агентских карточек
    code_globs:
      - internal/**/registry/**
      - pkg/**/agentcard/**
    test_globs:
      - tests/**/agent-registry/**
    responsibilities:
      - discovery
      - metadata storage
      - access filtering
    not_responsible_for:
      - agent selection
      - business orchestration
      - runtime execution
`,
  },
  {
    path: ".opencode/skills/memory-bank/SKILL.md",
    content: `---
name: memory-bank
description: Use repository memory bank before product, architecture, or behavior changes.
---

# Memory Bank Skill

Use this skill when changing product behavior, architecture boundaries, specs, or documentation.

## Required reading order

1. \`.ai/memory/README.md\`
2. \`.ai/memory/ontology.md\`
3. Relevant module cards
4. Relevant scenario cards
5. Relevant decision cards
6. Proposals and historical cards only when needed

## Before editing code

Run:

\`\`\`bash
npm run memory -- context "$ARGUMENTS"
\`\`\`

Then read related module, scenario, decision, code and test references.

## Critical rules

- Current behavior must be confirmed by code, tests, contracts, or reviewed memory.
- New specs are proposed behavior, not current behavior.
- Historical specs may preserve rationale but must not override current code.
- Demo code is example-only unless explicitly marked otherwise.
- Do not implement from rationale alone.
- If sources conflict, write the conflict to \`.ai/memory/reconciliation/conflicts.md\`.
- If information is missing, write an open question to \`.ai/memory/reconciliation/open-questions.md\`.
`,
  },
  {
    path: ".opencode/skills/memory-ingest-spec/SKILL.md",
    content: `---
name: memory-ingest-spec
description: Process a new product spec into proposals, rationale, conflicts, and safe memory updates.
---

# Memory Ingest Spec Skill

## Goal

Convert a new spec into safe memory updates.

## Steps

1. Classify the spec: document type, product area, modules, scenarios, decisions.
2. Extract proposed behavior, problem, value, rationale, constraints, alternatives, risks, acceptance criteria, open questions.
3. Compare with current memory: modules, scenarios, decisions, proposals, historical cards.
4. Check code evidence using code_refs/test_refs and repository search.
5. Create or update a proposal in \`.ai/memory/proposals/\`.
6. Update decisions only for rationale, not as direct code instructions.
7. Update conflicts/open-questions where needed.
8. Update Current behavior only if confirmed by code, tests, contracts, or explicit review.

## Forbidden

- Do not mark proposed behavior as current without evidence.
- Do not delete historical rationale.
- Do not treat historical specs as implementation guides.
- Do not silently resolve conflicts.
`,
  },
  {
    path: ".opencode/skills/memory-reconcile/SKILL.md",
    content: `---
name: memory-reconcile
description: Reconcile repository memory with current code, tests, contracts and docs.
---

# Memory Reconcile Skill

Use this skill to detect drift between \`.ai/memory\` and the repository.

## Steps

1. Run \`npm run memory -- validate\`.
2. List current module cards.
3. For each current module, verify major claims against code_refs and test_refs.
4. Find current claims with weak evidence.
5. Find proposals that may now be implemented.
6. Write unresolved contradictions to conflicts.
7. Write unresolved questions to open-questions.
8. Do not rewrite current memory from specs alone.
`,
  },
  {
    path: ".opencode/commands/memory-context.md",
    content: `---
description: Build a compact memory context pack for a task
agent: memory-coder
---

Use the memory-bank skill.

Task:
$ARGUMENTS

Steps:
1. Read \`.ai/memory/README.md\` and \`.ai/memory/ontology.md\`.
2. Run: \`npm run memory -- context "$ARGUMENTS"\`.
3. Read the recommended memory files.
4. Summarize relevant modules, scenarios, decisions, code paths, tests, conflicts, open questions, and things that must not be assumed.
`,
  },
  {
    path: ".opencode/commands/memory-ingest-spec.md",
    content: `---
description: Process a new spec into proposal/rationale/conflict memory updates
agent: memory-reviewer
---

Use the memory-ingest-spec skill.

Spec path:
$ARGUMENTS

Steps:
1. Read the spec.
2. Read \`.ai/memory/ontology.md\`.
3. Run memory context for the spec topic.
4. Classify the spec.
5. Extract proposed behavior and rationale.
6. Check related code/test evidence.
7. Create or update a proposal in \`.ai/memory/proposals/\`.
8. Update conflicts/open-questions if needed.
9. Do not update Current behavior unless evidence confirms it.
10. Show final diff and review notes.
`,
  },
  {
    path: ".opencode/commands/memory-reconcile.md",
    content: `---
description: Reconcile memory bank with code, tests and docs
agent: memory-reviewer
---

Use the memory-reconcile skill.

Goal: reconcile \`.ai/memory\` with current code, tests, contracts and docs.

Steps:
1. Run \`npm run memory -- validate\`.
2. Extract current claims from module/scenario cards.
3. Verify claims against code_refs/test_refs.
4. Find stale proposals and weak-evidence current claims.
5. Update conflicts and open questions.
6. Show a concise reconciliation report and diff.
`,
  },
  {
    path: ".opencode/agents/memory-extractor.md",
    content: `---
description: Structured memory classification and extraction agent
mode: subagent
temperature: 0.1
---

You classify documents and extract structured facts for the repository memory bank. Return concise structured outputs. Do not decide architectural conflicts; escalate those to memory-reviewer.
`,
  },
  {
    path: ".opencode/agents/memory-coder.md",
    content: `---
description: Code evidence and memory patch agent
mode: subagent
temperature: 0.1
---

You inspect code, tests, contracts and markdown memory files. Before changing code, use the memory-bank skill and memory context command. Current behavior requires code/test/contract/review evidence.
`,
  },
  {
    path: ".opencode/agents/memory-reviewer.md",
    content: `---
description: Rationale, conflict and final review agent for memory bank updates
mode: subagent
temperature: 0.2
---

You review design rationale, conflicts, source priority and current/proposed/historical separation. Do not allow proposed or historical material to become current behavior without evidence.
`,
  },
  {
    path: ".opencode/tools/memory.ts",
    content: `import { tool } from "@opencode-ai/plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runMemory(args: string[]) {
  try {
    const result = await execFileAsync("npm", ["run", "memory", "--", ...args], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 8,
    });
    return result.stdout || result.stderr;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return [err.stdout, err.stderr, err.message].filter(Boolean).join("\n");
  }
}

export const context = tool({
  description: "Build a compact repository memory context pack for a task.",
  args: {
    query: tool.schema.string().describe("Task or question to build memory context for"),
    limit: tool.schema.number().optional().describe("Maximum number of primary memory cards"),
  },
  async execute(args) {
    return runMemory(["context", args.query, "--limit", String(args.limit ?? 8)]);
  },
});

export const validate = tool({
  description: "Validate .ai/memory frontmatter, policies and relations.",
  args: {},
  async execute() {
    return runMemory(["validate", "--json"]);
  },
});

export const related = tool({
  description: "Show memory entities related to a given memory id.",
  args: {
    id: tool.schema.string().describe("Memory entity id"),
  },
  async execute(args) {
    return runMemory(["related", args.id, "--json"]);
  },
});
`,
  },
];
