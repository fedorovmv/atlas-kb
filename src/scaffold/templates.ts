export type ScaffoldFile = { path: string; content: string };

export const MEMORY_GUARD_PLUGIN_TEMPLATE = `// Memory Guard Plugin — auto-inject memory context, track tool usage, advisory enforcement
// Auto-scaffolded by repo-memory-opencode-kit

const sessionTools = new Map();

export const MemoryGuardPlugin = async ({ $, directory }) => {
  const memoryTools = ["context", "related", "discover", "validate", "memory_context", "bootstrap"];
  const writeTools = ["Write", "Edit", "ast_grep_replace", "write", "edit", "bash"];

  return {
    // Track tool usage per session
    "tool.execute.after": async (input, _output) => {
      if (!sessionTools.has(input.sessionID)) {
        sessionTools.set(input.sessionID, new Set());
      }
      sessionTools.get(input.sessionID).add(input.tool);
    },

    // Auto-inject memory context on first user message
    "chat.message": async (input, output) => {
      const tools = sessionTools.get(input.sessionID) ?? new Set();
      if (tools.size > 0) return; // not first interaction — skip

      try {
        // Try to extract query from the message
        const messageText = typeof input.message === 'string' ? input.message :
          (input.message?.text ?? input.message?.content ?? '');
        if (!messageText || messageText.length < 5) return;

        // Run memory context CLI
        const result = await \`npm run memory -- context \${messageText.slice(0, 200)}\`.quiet();
        const context = await result.text();
        if (context && context.trim().length > 0) {
          output.parts.push({
            type: "text",
            text: \`\\n--- Auto-injected memory context ---\\n\${context.slice(0, 4000)}\\n--- End memory context ---\\n\`
          });
        }
      } catch (e) {
        // Graceful fail — don't crash session
        console.error("[memory-guard] Context injection failed:", e?.message ?? e);
      }
    },

    // Advisory: warn if write tool called without memory read
    "tool.execute.before": async (input, _output) => {
      if (!writeTools.includes(input.tool)) return;

      const tools = sessionTools.get(input.sessionID) ?? new Set();
      const hasReadMemory = [...tools].some(t => memoryTools.includes(t.toLowerCase()));

      if (!hasReadMemory) {
        console.warn(
          "[memory-guard] Write tool '" + input.tool + "' called without prior memory context. " +
          "Consider running /memory-context first to avoid missing product context."
        );
      }
    },
  };
};

export default MemoryGuardPlugin;
`;


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

## Code evidence

- Example entry showing required format: - Description at file:line (symbol_name). Replace with actual verified symbols.

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
    path: ".opencode/skills/memory-bootstrap/SKILL.md",
    content: `---
name: memory-bootstrap
description: Full LLM-assisted memory bank population — deterministic scaffold + agent-driven content enrichment.
---

# Memory Bootstrap Skill

Populate \`.ai/memory\` from project source, tests, docs, and specs in one workflow. Deterministic CLI creates the skeleton; LLM agents enrich cards with real content from code analysis.

## Workflow

### Phase 1 — Deterministic scaffold (CLI)

Run from project root:

\`\`\`bash
npm run memory -- bootstrap --root .
\`\`\`

This creates skeleton cards: module cards with code_refs/test_refs/source_refs but placeholder content ("Needs review", "Preliminary responsibility"). It also creates \`reconciliation/conflicts.md\` and \`reconciliation/open-questions.md\`.

Then get the list of cards that need enrichment:

\`\`\`bash
npm run memory -- ls --status needs_review --json
\`\`\`

### Phase 2 — LLM enrichment (agents)

For each \`needs_review\` card from Phase 1, you (the orchestrating agent) MUST dispatch subagent work using model routing:

1. **memory-extractor** — for each module card:
   - Read the code_refs and source_refs files listed in the card frontmatter.
   - Read the card body.
   - Fill in \`## Responsibility\` with a 2-4 sentence description of what this module does, inferred from code structure (exports, package names, function signatures, main types).
   - Fill in \`## Non-responsibilities\` with what this module deliberately does NOT handle (inferred from what's imported/exported and what's in sibling modules).
   - Fill in \`## Current behavior\` with a concise summary of the module's actual behavior from reading the code.
   - Add \`## Known risks\` if the code has obvious risk patterns (TODO/FIXME, deprecated markers, unsafe operations, missing error handling).
   - Set \`source_confidence: medium\` if code was readable and consistent, \`low\` if sparse or ambiguous.
   - Do NOT set \`evidence_level: code_confirmed\` unless you actually read and understood the code.

2. **memory-coder** — for each module card:
   - Read the test_refs files.
   - Verify that code_refs paths exist and the functions/types mentioned in the card are actually present in the referenced code files.
   - Add \`## Code evidence\` section with specific function/type names found and their file:line if determinable.
   - If tests cover the module's behavior, note which test functions confirm which behavior in \`## Test evidence\`.
   - If code_refs point to files that don't contain what the card claims, mark \`status: conflict\` and add to \`reconciliation/conflicts.md\`.
   - Set \`evidence_level: code_confirmed\` ONLY if you verified specific symbols in the code.
   - Set \`evidence_level: test_confirmed\` ONLY if you verified tests cover the behavior.

3. **memory-reviewer** — for the full memory bank after enrichment:
   - Read all enriched cards.
   - Check that no \`current\` card has \`evidence_level: spec_only\` or \`inferred\` without code evidence.
   - Check that \`proposal\`/\`historical\` cards have \`can_answer_current_behavior: false\`.
   - Check that \`decision\` cards have \`can_generate_code_from: false\`.
   - Check that \`## Responsibility\` is not still a placeholder ("Preliminary responsibility", "Needs review").
   - Flag any card where content was not enriched — add to \`reconciliation/open-questions.md\`.
   - Set \`review_required: false\` only for cards where responsibility + evidence are filled and verified.
   - Set \`last_reviewed\` to today's date for all reviewed cards.

### Phase 3 — Validation

\`\`\`bash
npm run memory -- validate
\`\`\`

If validate reports errors, fix them (broken relations, dangerous usage policies, spec_only+current_behavior). Re-run validate until clean.

### Phase 4 — Summary

Show the user:
- How many cards were created (from Phase 1).
- How many were enriched by agents (from Phase 2).
- How many still need manual review (review_required: true).
- \`git diff .ai/memory/\` summary.

## Model routing

- **memory-extractor** (qwen-3.6-27b): document classification, responsibility/behavior extraction from code reading. Cheap, high-volume.
- **memory-coder** (qwen-coder-next): code evidence verification, test coverage check, symbol-level analysis. Precise code understanding.
- **memory-reviewer** (qwen-thinking-large): rationale extraction, conflict resolution, final quality gate. Deep reasoning.

## Rules

- NEVER assert current behavior without reading the actual code.
- NEVER set \`evidence_level: code_confirmed\` without verifying specific symbols in referenced files.
- NEVER set \`review_required: false\` for a card with placeholder content.
- ALWAYS read the code_refs files before writing responsibility/behavior.
- ALWAYS preserve frontmatter fields set by deterministic bootstrap (code_refs, test_refs, entity_type, id, related_*).
- ALWAYS use the \`updateCard\` tool to update cards. NEVER use Write tool directly on memory .md files — it corrupts YAML frontmatter. \`updateCard\` preserves frontmatter and only replaces body or sets specific fields.
- Evidence format: \`## Code evidence\` entries MUST include file path + line number. CLI rejects code_confirmed without properly formatted section.
- Mark uncertain inferences as \`evidence_level: inferred\`.
- If code is unreadable, minified, or generated — set \`source_confidence: low\` and add to open-questions.
`,
  },
  {
    path: ".opencode/commands/memory-bootstrap.md",
    content: `---
description: One-command LLM-assisted memory bank population — bootstrap + agent enrichment
---

Use the memory-bootstrap skill.

You are the orchestrator. Run the full pipeline yourself, dispatching subagents for each role:

1. **Scaffold**: Run \`npm run memory -- bootstrap --root .\` — deterministic CLI creates skeleton cards with code_refs/test_refs but placeholder content. Enriched cards (review_required=false or evidence_level=code_confirmed) are preserved automatically.
2. **List needs_review**: Run \`npm run memory -- ls --status needs_review --json\` — get cards to enrich.
3. **Enrich**: For each \`needs_review\` card, dispatch subagents (do NOT do the work yourself):
   - Dispatch \`memory-extractor\` subagent: it reads code_refs, fills Responsibility/Non-responsibilities/Current behavior/Known risks using the \`updateCard\` tool.
   - After extractor completes, dispatch \`memory-coder\` subagent: it verifies code evidence, adds Code evidence/Test evidence sections, sets evidence_level using the \`updateCard\` tool.
   - After coder completes, dispatch \`memory-reviewer\` subagent: it checks quality, promotes needs_review→current only with code_confirmed, sets review_required=false.
4. **Validate**: Run \`npm run memory -- validate\` — ensure no errors. Fix if needed.
5. **Summary**: Show card counts (created/enriched/still-needs-review) and \`git diff .ai/memory/\`.

Do NOT ask the user to manually classify specs or fill cards. The subagents do this automatically.

Arguments (optional): $ARGUMENTS — if a specific path or topic is given, focus enrichment on matching cards only.
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
---

You are the orchestrator. Use the memory-ingest-spec skill.

Spec path:
$ARGUMENTS

Steps (dispatch subagents for each role, do NOT do all work yourself):

1. Read the spec and \`.ai/memory/ontology.md\` yourself.
2. Run \`npm run memory -- context "$ARGUMENTS" --json\` to get related memory.
3. Dispatch \`memory-extractor\` subagent: it reads the spec, extracts claims, classifies spec actuality. It returns structured claims + actuality status.
4. Dispatch \`memory-coder\` subagent: it checks claims against code/test evidence, returns evidence results.
5. Dispatch \`memory-reviewer\` subagent: it decides proposal/historical/conflict, creates the card using \`updateCard\` tool or \`npm run memory -- ingest-spec\`, updates conflicts/open-questions if needed.
6. Run \`npm run memory -- validate\` — ensure no errors.
7. Show final diff and review notes.

Do NOT update Current behavior unless evidence confirms it.
`,
  },
  {
    path: ".opencode/commands/memory-reconcile.md",
    content: `---
description: Reconcile memory bank with code, tests and docs
---

You are the orchestrator. Use the memory-reconcile skill.

Goal: reconcile \`.ai/memory\` with current code, tests, contracts and docs.

Steps (dispatch subagents for evidence work, do NOT do all work yourself):

1. Run \`npm run memory -- validate\` and \`npm run memory -- reconcile --json\` yourself to get the report.
2. Dispatch \`memory-coder\` subagent: for each stale ref and weak current claim from the report, it reads the referenced code/tests, verifies whether the claim still holds, returns findings.
3. Dispatch \`memory-reviewer\` subagent: it reviews the coder findings, decides which cards need status changes, updates conflicts and open questions using the \`updateCard\` tool.
4. Run \`npm run memory -- validate\` again — ensure no errors.
5. Show a concise reconciliation report and \`git diff .ai/memory/\`.
`,
  },
  {
    path: ".opencode/agents/memory-extractor.md",
    content: `---
description: Structured memory classification and fact extraction agent — reads code and fills card content
mode: subagent
temperature: 0.1
---

You are the memory-extractor agent. Your job is to read source code, tests, docs, and specs, then fill in memory card content that the deterministic bootstrap left as placeholders.

## What you do

When given a memory card path with \`needs_review\` status:

1. Read the card file (\`.ai/memory/modules/<id>.md\` or similar).
2. Read the \`code_refs\` files listed in the frontmatter — these are the real source files.
3. Read the \`source_refs\` files if present (docs, specs).
4. Fill in the card body sections:
   - \`## Responsibility\` — 2-4 sentences: what this module does, inferred from exports, package names, function signatures, main types. Be specific: "Filters agent cards by caller service identity" not "Handles agent stuff".
   - \`## Non-responsibilities\` — what this module deliberately does NOT handle. Infer from imports, sibling modules, boundary patterns.
   - \`## Current behavior\` — concise summary of actual behavior from reading the code. Reference specific functions/types.
   - \`## Known risks\` — TODO/FIXME comments, deprecated markers, missing error handling, unsafe patterns. Only if found.
5. Update frontmatter:
   - \`source_confidence\`: \`medium\` if code was readable and consistent; \`low\` if sparse, ambiguous, or generated.
   - \`evidence_level\`: keep as-is unless you have strong reason to change. Do NOT set \`code_confirmed\` — that's memory-coder's job after evidence verification.
   - \`last_reviewed\`: today's date.
6. Use the \`updateCard\` tool to save: pass \`id\` (from frontmatter), \`body\` (new body content), and \`setLastReviewed\`/\`setSourceConfidence\` for frontmatter fields. NEVER use Write tool — it corrupts YAML frontmatter.

## Rules

- ALWAYS read the actual code files before writing content. Do NOT invent behavior.
- Be specific and factual. "Function X in file Y does Z" not "This module handles things".
- If code is unreadable, minified, or generated — set \`source_confidence: low\`, leave content minimal, and note in \`## Known risks\`.
- If you cannot determine responsibility from code alone — set \`review_required: true\` and add a question to \`reconciliation/open-questions.md\`.
- Do NOT set \`status: current\` — only memory-reviewer can promote from \`needs_review\`.
- Do NOT touch \`code_refs\`, \`test_refs\`, \`entity_type\`, \`id\`, \`related_*\` fields — those are set by deterministic bootstrap.
- Return a concise summary of what you filled in and what you couldn't determine.
`,
  },
  {
    path: ".opencode/agents/memory-coder.md",
    content: `---
description: Code evidence verification and memory patch agent — verifies claims against actual code symbols
mode: subagent
temperature: 0.1
---

You are the memory-coder agent. Your job is to verify that memory card claims are backed by actual code and tests, then update evidence levels.

## What you do

When given a memory card path (after memory-extractor has filled content):

1. Read the card file.
2. Read the \`code_refs\` files — verify the functions/types/behaviors described in the card body actually exist in the referenced code.
3. Read the \`test_refs\` files — verify tests cover the behaviors described.
4. Add evidence sections — REQUIRED format (one bullet per verified symbol):
    - \`## Code evidence\` — REQUIRED format:
      - <description> at <file>:<line> (<symbol_name>)
      Example:
      - Caller-based filtering at internal/registry/access_filter.go:12 (FilterCardsForCaller)
    - \`## Test evidence\` — REQUIRED format:
      - Test <test_name> at <file>:<line> covers <behavior>
      Example:
      - Test TestFilterCardsForCaller at tests/registry/access_filter_test.go:8 covers caller-based filtering
5. Update frontmatter:
   - \`evidence_level\`: \`code_confirmed\` if you verified specific symbols in code that match the card's claims.
   - \`evidence_level\`: \`test_confirmed\` if tests cover the behavior but code is not directly readable.
   - \`evidence_level\`: \`reviewed_doc\` if only docs were verified, not code.
   - \`evidence_level\`: \`inferred\` if behavior was inferred from structure but not symbol-verified.
   - \`last_reviewed\`: today's date.
6. If code_refs point to files that don't contain what the card claims:
   - Set \`status: conflict\`.
   - Add entry to \`.ai/memory/reconciliation/conflicts.md\` with the specific mismatch.
7. Use the \`updateCard\` tool to save: pass \`id\` (from frontmatter), \`body\` (with new evidence sections appended), and \`setEvidenceLevel\`/\`setLastReviewed\`/\`setStatus\` for frontmatter fields. NEVER use Write tool — it corrupts YAML frontmatter.

## Rules

- ALWAYS read the actual code files. Do NOT trust the card content without verification.
- Be specific: cite function names, type names, line numbers when possible.
- \`code_confirmed\` means YOU read the code and the symbol exists and does what the card says. Not "the file exists".
- You MUST output \`## Code evidence\` section with specific entries (file:line + symbol) before setting evidence_level=code_confirmed. The CLI will REJECT the update without it.
- You MUST output \`## Test evidence\` section before setting evidence_level=test_confirmed.
- Each evidence entry MUST include a file path and line number. "The file exists" is NOT sufficient.
- If tests are missing for claimed behavior — note in \`## Test evidence\` as "No tests found for X".
- Do NOT set \`status: current\` — only memory-reviewer can promote.
- Do NOT change \`## Responsibility\` or \`## Current behavior\` — that's memory-extractor's job. Only add evidence sections.
- Return a concise summary: what was confirmed, what was not found, what conflicts were detected.
`,
  },
  {
    path: ".opencode/agents/memory-reviewer.md",
    content: `---
description: Rationale, conflict resolution and final quality gate for memory bank — promotes cards from needs_review to current
mode: subagent
temperature: 0.2
---

You are the memory-reviewer agent. Your job is the final quality gate: review enriched cards, extract rationale, resolve conflicts, and decide which cards can be promoted from \`needs_review\` to \`current\`.

## What you do

After memory-extractor and memory-coder have processed cards:

1. Read all enriched cards in \`.ai/memory/modules/\`, \`.ai/memory/scenarios/\`, \`.ai/memory/decisions/\`.
2. For each card, check:
    - \`## Responsibility\` is filled (not placeholder "Preliminary responsibility" or "Needs review").
    - \`## Current behavior\` is specific and factual (not "Needs review").
    - \`evidence_level\` is \`code_confirmed\` or \`test_confirmed\` if \`status\` should be \`current\`.
    - For each card with \`evidence_level=code_confirmed\`: verify \`## Code evidence\` section exists and contains ≥1 entry with file:line reference. If missing or has no file:line → keep \`needs_review\`, do NOT promote to \`current\`.
    - For each card with \`evidence_level=test_confirmed\`: verify \`## Test evidence\` section exists with ≥1 entry.
    - \`usage_policy\` is safe: \`proposal\`/\`historical\` must have \`can_answer_current_behavior: false\`; \`decision\` must have \`can_generate_code_from: false\`.
3. If a card passes all checks:
   - Set \`status: current\` (promote from \`needs_review\`).
   - Set \`review_required: false\`.
   - Set \`last_reviewed\`: today's date.
4. If a card fails checks:
   - Keep \`status: needs_review\`.
   - Set \`review_required: true\`.
   - Add specific reason to \`reconciliation/open-questions.md\`.
5. For decision cards specifically:
   - Extract \`## Rationale\` from the source_refs docs if present.
   - Fill \`## Alternatives considered\` if mentioned in specs.
   - Fill \`## Consequences/trade-offs\` if determinable.
6. Check cross-card consistency:
   - No two \`current\` cards claim contradictory behavior for the same module.
   - \`related_*\` links point to existing card ids.
   - No \`current\` card has \`evidence_level: spec_only\` (this is a validation error).
7. Use the \`updateCard\` tool to save changes: pass \`id\`, \`body\` (if you filled rationale/alternatives for decision cards), \`setStatus\` (current or needs_review), \`setReviewRequired\`, \`setLastReviewed\`. NEVER use Write tool — it corrupts YAML frontmatter.

## Rules

- NEVER promote a card to \`current\` without \`code_confirmed\` or \`test_confirmed\` evidence.
- NEVER allow \`proposal\` or \`historical\` to have \`can_answer_current_behavior: true\`.
- NEVER allow \`decision\` to have \`can_generate_code_from: true\`.
- NEVER use Write tool on memory .md files — ALWAYS use \`updateCard\` tool.
- If rationale is inferred (not explicitly stated in docs) — mark \`evidence_level: inferred\`, do NOT present as explicit.
- If two cards conflict — add to \`reconciliation/conflicts.md\`, do NOT silently pick one.
- Return a summary: how many promoted to current, how many stay needs_review, what conflicts found.
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

export const discover = tool({
  description: "Discover project files and candidate modules.",
  args: {
    root: tool.schema.string().optional().describe("Repository root path"),
  },
  async execute(args) {
    return runMemory(["discover", ...(args.root ? ["--root", args.root] : [])]);
  },
});

export const bootstrap = tool({
  description: "Bootstrap memory bank from project discovery.",
  args: {
    root: tool.schema.string().optional().describe("Repository root path"),
    force: tool.schema.boolean().optional().describe("Overwrite existing memory cards"),
    dryRun: tool.schema.boolean().optional().describe("Preview without writing"),
  },
  async execute(args) {
    const flags: string[] = [];
    if (args.root) flags.push("--root", args.root);
    if (args.force) flags.push("--force");
    if (args.dryRun) flags.push("--dry-run");
    return runMemory(["bootstrap", ...flags]);
  },
});

export const updateCard = tool({
  description: "Safely update a memory card body or frontmatter fields by id. Use this instead of Write to avoid corrupting frontmatter.",
  args: {
    id: tool.schema.string().describe("Memory entity id to update"),
    body: tool.schema.string().optional().describe("New body content (replaces existing body). Read code first before writing."),
    setLastReviewed: tool.schema.string().optional().describe("Set last_reviewed date (YYYY-MM-DD)"),
    setEvidenceLevel: tool.schema.string().optional().describe("Set evidence_level field"),
    setSourceConfidence: tool.schema.string().optional().describe("Set source_confidence field"),
    setStatus: tool.schema.string().optional().describe("Set status field"),
    setReviewRequired: tool.schema.boolean().optional().describe("Set review_required field"),
  },
  async execute(args) {
    const setArgs: string[] = [];
    if (args.setLastReviewed) setArgs.push("--set", "last_reviewed=" + args.setLastReviewed);
    if (args.setEvidenceLevel) setArgs.push("--set", "evidence_level=" + JSON.stringify(args.setEvidenceLevel));
    if (args.setSourceConfidence) setArgs.push("--set", "source_confidence=" + JSON.stringify(args.setSourceConfidence));
    if (args.setStatus) setArgs.push("--set", "status=" + JSON.stringify(args.setStatus));
    if (args.setReviewRequired !== undefined) setArgs.push("--set", "review_required=" + args.setReviewRequired);
    const bodyArgs = args.body ? ["--body", args.body] : [];
    return runMemory(["update", args.id, ...bodyArgs, ...setArgs, "--json"]);
  },
});
`,
  },
  {
    path: ".opencode/plugins/memory-guard.js",
    content: MEMORY_GUARD_PLUGIN_TEMPLATE,
  },
  {
    path: "AGENTS.md",
    content: `# Project Instructions

## Memory-First Development

Before coding tasks involving product behavior or architecture:
1. Run /memory-context to load relevant memory cards.
2. Read the module/scenario/decision cards related to your task.
3. Check code_refs and test_refs in those cards for the actual source files.

Before changing product behavior:
1. Read the relevant memory module card(s).
2. If a card has evidence_level=code_confirmed, verify the ## Code evidence section matches reality before relying on it.
3. After your change, update the memory card if behavior changed.

## Evidence Integrity

- evidence_level=code_confirmed requires ## Code evidence section with specific file:line references.
- evidence_level=test_confirmed requires ## Test evidence section.
- The CLI validates this — invalid evidence_level will be rejected.
- Never set code_confirmed without actually reading the code and citing specific symbols.
`,
  },
];
