# Specification: Constitution, Clarify, Tasks, and Analyze Stages for the Spec Pipeline

- **Date**: 2026-08-13
- **Status**: Draft
- **Slug**: `speckit-inspired-stages`

## Problem Statement

The Specification-Driven Pipeline documented in `templates/chowa-workflow.md`
(and generated into `skills/chowa-skill/SKILL.md`) covers Backlog → Spec →
Plan → Execute, but has four gaps:

1. No durable, project-wide principles document — every spec is drafted
   from scratch with no standing reference for non-negotiables or style
   conventions.
2. No explicit ambiguity-resolution pass before a spec is approved —
   underspecified requirements surface only during Stage 3, when they're
   more expensive to fix.
3. No cross-artifact consistency check between `spec.md` and
   `implementation_plan.md` before execution starts — a plan that silently
   drops a goal, or covers something the spec never asked for, isn't
   caught until code review.
4. No persisted breakdown of an approved plan into discrete work items.
   `TaskCreate`/`TaskUpdate` tracking is ephemeral and vanishes at session
   end, leaving no durable delegation boundary and no record of what was
   actually planned versus done.

GitHub's [spec-kit](https://github.com/github/spec-kit) toolkit ships all
four of these as `/speckit.constitution`, `/speckit.clarify`,
`/speckit.tasks`, and `/speckit.analyze`. spec-kit itself is a separately
installed Python CLI (`specify-cli` via `uv`), which conflicts with this
project's core design constraint — `skills/chowa-skill/SKILL.md`'s own
frontmatter states "No CLI, no bundled engine, nothing to install or
version separately from the skill itself." This spec adds the four ideas
natively — as prompt-driven workflow steps and persisted markdown
artifacts inside the existing pipeline — without adopting the external
tool.

## Goals

1. **Constitution** — `specs/CONSTITUTION.md`, a project-wide principles
   document, created once per project (offered before a project's first
   spec) and referenced — not re-litigated — by every subsequent spec's
   drafting step.
2. **Clarify** — an ambiguity-resolution pass folded into Stage 1, run
   after drafting `spec.md` but before requesting the user's approval:
   scan for underspecified or ambiguous requirements and resolve them with
   the user before finalizing.
3. **Tasks** — a persisted `tasks.md`, written to the same
   `specs/<YYYY-MM-DD>-<slug>/` directory as `spec.md` and
   `implementation_plan.md`, breaking the approved plan into discrete,
   independently-completable work items. Distinct from ephemeral
   `TaskCreate`/`TaskUpdate` tracking; feeds both delegation (a task line
   is the "exactly what the correct output looks like" boundary already
   required by the Delegating Mechanical Sub-Tasks step) and Stage 3
   execution tracking.
4. **Analyze** — a new stage between Stage 2 and Stage 3: cross-check
   `spec.md`'s goals/acceptance criteria against `implementation_plan.md`'s
   (and `tasks.md`'s) coverage, and report gaps or contradictions to the
   user rather than silently resolving them.
5. All four ship through `templates/chowa-workflow.md` as `shared` blocks
   — none require a CLI command, so none need a `chowa-only` /
   `chowa-skill-only` split — then propagate to `skills/chowa-skill/SKILL.md`
   via the existing generator (`node scripts/generate-skill.mjs`), never
   hand-edited directly.
6. `scripts/guard-spec.mjs` extended to also guard root-level `tasks.md`,
   consistent with its existing `spec.md` / `implementation_plan.md`
   protection.

## Non-Goals

- Adopting spec-kit itself, its CLI, or its slash-command surface.
- A `/speckit.converge`-equivalent completeness-scoring stage — decided
  against in prior discussion as under-specified and premature.
- Changes to chowa's own CLI-backed repository
  (`github.com/franprince/chowa`) — this spec only touches the shared
  template. `sync-skill.ts` there picks up these blocks automatically
  whenever that repo's maintainer bumps its pinned commit SHA; that action
  is outside this spec's control and not required for this spec to ship.
- Restructuring `specs/INDEX.md`'s schema — `tasks.md` is a sibling file
  discoverable inside each spec's own directory; no new INDEX column is
  required.
- Guarding `specs/CONSTITUTION.md`'s location in `guard-spec.mjs` — it's a
  single, project-level file meant to live at that exact path, not a
  per-iteration artifact at risk of being silently overwritten across
  features the way `spec.md` / `implementation_plan.md` / `tasks.md` are.

## Specification Details

### 1. Constitution (`specs/CONSTITUTION.md`)

Add a new item to the Specification-Driven Pipeline list, checked before
Stage 0:

- If `specs/CONSTITUTION.md` doesn't exist and this is the project's first
  spec, offer to draft one collaboratively with the user (domain
  principles, non-negotiables, style conventions) before Stage 1 of the
  first feature. If the user declines, proceed straight to Stage 1 — this
  step never blocks the pipeline.
- If it exists, Stage 1 drafting must read it and stay consistent with it.
  A spec that would conflict with the constitution gets flagged to the
  user rather than silently drafted around it.
- Lives once per project at `specs/CONSTITUTION.md` — not per-feature.
  Updated in place when principles change, with the change called out to
  the user since it affects every future spec.

### 2. Clarify (Stage 1 sub-step)

Insert into the existing Stage 1 description: after drafting `spec.md`'s
content but before requesting the user's explicit approval, scan the
draft for ambiguous or underspecified requirements — vague acceptance
criteria, unstated edge-case behavior, conflicting goals — and resolve
them with the user (`AskUserQuestion` for discrete choices, plain
questions otherwise), updating the draft before presenting it for
approval. This is a pass over the already-drafted content, not a new
persisted artifact.

### 3. Tasks (Stage 2 sub-step, `tasks.md`)

Insert into the existing Stage 2 description: once `implementation_plan.md`
is approved, break it into a persisted `tasks.md` — a checklist of
discrete, independently-completable work items, each stated concretely
enough to hand to delegation or execute directly. Written to the same
`specs/<YYYY-MM-DD>-<slug>/` directory as `spec.md` and
`implementation_plan.md`. At the start of Stage 3, mirror `tasks.md`'s
items into ephemeral `TaskCreate` entries for in-session progress
tracking; `tasks.md` itself stays the durable record, checked off (or
annotated) as items complete.

### 4. Analyze (new stage, between Stage 2 and Stage 3)

New numbered item in the Specification-Driven Pipeline list, after Stage 2
(and its `tasks.md` sub-step) and before Stage 3: cross-check `spec.md`'s
goals/acceptance criteria against `implementation_plan.md`'s (and
`tasks.md`'s) coverage — every goal traceable to at least one plan
component/task, no plan component without a goal it serves. Report
findings to the user rather than silently resolving them; the user
decides whether to revise the spec/plan or proceed as-is. Skippable at the
same judgment threshold already used for Stage 0's Backlog Breakdown
("complex tasks spanning multiple modules...") — a small, obvious change
doesn't need a formal analysis pass.

### 5. `templates/chowa-workflow.md` changes

- Author all four additions as `shared` blocks — none require a CLI
  command, all are prompt-driven judgment plus file writes, so no
  `chowa-only` / `chowa-skill-only` split is needed.
- Regenerate `skills/chowa-skill/SKILL.md` via
  `node scripts/generate-skill.mjs` — never hand-edited.
- These blocks apply verbatim to chowa's own CLI-backed skill too, once
  `sync-skill.ts` bumps its pin — no `chowa-only` wiring needed there
  either, since none of the four require CLI commands.

### 6. `scripts/guard-spec.mjs` changes

- Extend `isRootSpecPath` to also match `tasks.md` (case-insensitive, same
  root-level-only semantics as `spec.md` / `implementation_plan.md`).
- Update the block reason message to mention all three filenames.
- `specs/CONSTITUTION.md` is intentionally **not** guarded — it's meant to
  live at that exact path, not under a dated feature directory.

### 7. Tests

- `tests/guard-spec.test.mjs`: add cases for `tasks.md` paralleling the
  existing `spec.md` / `implementation_plan.md` cases (root-level blocked,
  `specs/<date>-slug/tasks.md` allowed).
- `tests/generate-skill.test.mjs`: the existing "committed generated skill
  matches template" test fails until `skills/chowa-skill/SKILL.md` is
  regenerated — Stage 3 execution must run the generator and re-run tests
  before committing.

## Acceptance Criteria

1. `templates/chowa-workflow.md` documents Constitution, Clarify, Tasks,
   and Analyze inside/around the existing Specification-Driven Pipeline
   section, all as `shared` blocks.
2. `skills/chowa-skill/SKILL.md` is regenerated from the template (via
   `node scripts/generate-skill.mjs`) and reflects all four additions with
   sequential `### ` numbering intact.
3. `scripts/guard-spec.mjs` blocks root-level `tasks.md` the same way it
   already blocks `spec.md` / `implementation_plan.md`, and allows
   `specs/<date>-slug/tasks.md`.
4. `tests/guard-spec.test.mjs` covers the new `tasks.md` cases and passes
   under `node --test`.
5. `tests/generate-skill.test.mjs` passes (generated file matches
   template) after regeneration.
6. `specs/INDEX.md` has a row for this spec.
