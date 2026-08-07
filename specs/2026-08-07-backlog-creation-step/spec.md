# Specification: Backlog Creation Step for Complex Tasks

- **Date**: 2026-08-07
- **Status**: Done
- **Slug**: `backlog-creation-step`

## Problem Statement

When a user request involves a large, multi-component feature, repo-wide refactor, or complex architectural change, attempting to capture everything in a single `spec.md` makes specifications bloated, hard to track, and difficult to verify atomically.

## Goals

1. Define an explicit **Backlog Creation Step** within the Specification-Driven Pipeline for complex, multi-stage tasks.
2. Store multi-task roadmaps in `specs/BACKLOG.md` (and optional per-feature task lists).
3. Establish a clear breakdown workflow: Large Task → Backlog (`BACKLOG.md`) → Individual Feature Specs (`specs/<YYYY-MM-DD>-<slug>/spec.md`) → Execution.

## Non-Goals

- Mandating a backlog for small or single-feature tasks (simple tasks go directly to `spec.md`).
- Replacing standard project issue trackers (Jira, GitHub Issues) — this is a local spec pipeline tool.

## Specification Details

### 1. Trigger Condition
A task requires a Backlog Step when it meets any of the following criteria:
- Spans 3 or more distinct sub-components/modules.
- Requires multiple separate pull requests or git branches.
- Involves dependent phases where Phase N relies on Phase N-1.

### 2. Backlog File Format (`specs/BACKLOG.md`)
The backlog file must follow this structure:
```markdown
# Project / Feature Backlog

- **Epic**: [High-level epic name]
- **Status**: In Progress

## Tasks

- [ ] **[TASK-01] Task Title**
  - **Description**: Summary of the sub-task.
  - **Dependencies**: None
  - **Spec Directory**: `specs/YYYY-MM-DD-task-slug/`
  - **Status**: Pending | In Progress | Completed
```

### 3. Workflow Progression
1. **Backlog Stage**: User and agent agree on `specs/BACKLOG.md` items for complex requests.
2. **Item Lifecycle**: For each backlog item, run the standard Chōwa pipeline (`spec.md` → `implementation_plan.md` → code → tests → commit/PR).
3. **Status Sync**: Update `specs/BACKLOG.md` as items transition from Pending to In Progress to Completed.

## Acceptance Criteria

1. `templates/chowa-workflow.md` updated with the Backlog Creation Step in the shared pipeline rules.
2. `node scripts/generate-skill.mjs` executed to generate updated `skills/chowa-skill/SKILL.md`.
3. `node --test` passes cleanly.
