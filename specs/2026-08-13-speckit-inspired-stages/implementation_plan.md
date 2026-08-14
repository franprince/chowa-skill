# Implementation Plan: Constitution, Clarify, Tasks, and Analyze Stages for the Spec Pipeline

- **Date**: 2026-08-13
- **Status**: Draft
- **Slug**: `speckit-inspired-stages`

## Proposed Changes

### 1. `templates/chowa-workflow.md` (source of truth — edit here, not `SKILL.md`)

The `<!-- variant:shared -->` block titled `### Specification-Driven
Pipeline (Spec → Plan → Execute)` (currently a 5-item numbered list: Stage
0 Backlog, Stage 1 Spec, Stage 2 Plan, Persistence, Stage 3 Execute) is
replaced in place with a 7-item numbered list. Item text stays `shared`
throughout — none of the new items require a CLI command, so no
`chowa-only` / `chowa-skill-only` split is introduced:

```markdown
1. **Constitution Check (`specs/CONSTITUTION.md`)** — if this is the
   project's first spec and `specs/CONSTITUTION.md` doesn't exist, offer
   to draft one collaboratively with the user (domain principles,
   non-negotiables, style conventions) before Stage 1. Decline is fine —
   this step never blocks the pipeline. If it exists, Stage 1 drafting
   must read it and stay consistent with it; a spec that would conflict
   with the constitution gets flagged to the user rather than silently
   drafted around it. Lives once per project, not per-feature — updated
   in place when principles change, with the change called out to the
   user since it affects every future spec.
2. **Stage 0: Backlog Breakdown (`specs/BACKLOG.md`)** — for complex tasks
   spanning multiple modules, dependent phases, or multiple PRs, create
   `specs/BACKLOG.md` first to outline epic milestones, sub-tasks, and
   execution order before breaking individual tasks into specs.
3. **Stage 1: Specification (`spec.md`)** — problem statement, goals,
   non-goals, input/output schemas, edge cases, and acceptance criteria.
   Before requesting approval, run a clarification pass over the draft:
   scan it for ambiguous or underspecified requirements — vague
   acceptance criteria, unstated edge-case behavior, conflicting goals —
   and resolve them with the user (`AskUserQuestion` for discrete
   choices, plain questions otherwise), updating the draft accordingly.
   Get explicit user approval before Stage 2.
4. **Stage 2: Implementation Plan (`implementation_plan.md`)** — files to
   modify/create, component boundaries, test plan. Once approved, break
   it into a persisted `tasks.md` — a checklist of discrete,
   independently-completable work items, each stated concretely enough to
   hand to delegation or execute directly. Get explicit user approval
   before writing code.
5. **Persistence** — write `spec.md`, `implementation_plan.md`, and
   `tasks.md` to `specs/<YYYY-MM-DD>-<slug>/`, never as loose root-level
   files, and add a row to `specs/INDEX.md` (create that layout if the
   project doesn't have one yet). Root-level files get overwritten by the
   next feature's docs with no record of what was approved — that's how
   intent drifts across iterations.
6. **Analyze** — cross-check `spec.md`'s goals/acceptance criteria against
   `implementation_plan.md`'s (and `tasks.md`'s) coverage: every goal
   traceable to at least one plan component/task, no plan component
   without a goal it serves. Report findings to the user rather than
   silently resolving them — they decide whether to revise or proceed.
   Skippable at the same judgment threshold as Stage 0 (a small, obvious
   change doesn't need a formal pass).
7. **Stage 3: Execution & Verification** — implement the approved plan
   (code + tests), mirroring `tasks.md`'s items into ephemeral
   `TaskCreate` entries for in-session tracking (`tasks.md` stays the
   durable record), then verify with the project's own quality gates (see
   the Code Quality & Build Verification section below). Always ask the
   user if they want a Pull Request opened after committing on a new
   feature branch.
```

No other block in the template changes — Branching & PR Workflow, Commit
Workflow, Code Quality, Hooks, Delegation, PR Description Generation,
Roadmap Visualization, and STE100 sections are untouched.

### 2. `skills/chowa-skill/SKILL.md` (generated — not hand-edited)

Run `node scripts/generate-skill.mjs` after step 1 lands. This rewrites
the file from the template, renumbering `### ` headings in document order.
No manual edits to this file in this plan.

### 3. `scripts/guard-spec.mjs`

- `isRootSpecPath`: extend the match condition
  `lower === 'spec.md' || lower === 'implementation_plan.md'` to also
  include `lower === 'tasks.md'`.
- `decide()`'s blocked-reason strings (both the file-tool branch and the
  Bash-command branch) currently read "Creating or editing root-level
  `${filePath}`..." / "Command `${segment}` targets a root-level spec
  file." — update the trailing guidance sentence in both
  (`Save feature specs in specs/<YYYY-MM-DD>-<slug>/spec.md and record
  them in specs/INDEX.md.`) to also mention `tasks.md`:
  `Save feature specs in specs/<YYYY-MM-DD>-<slug>/ (spec.md,
  implementation_plan.md, tasks.md) and record them in specs/INDEX.md.`
- No change to the JSDoc comment's file list at the top other than adding
  `tasks.md` alongside the other two names.

### 4. `tests/guard-spec.test.mjs`

Add `tasks.md` cases mirroring every existing `spec.md` /
`implementation_plan.md` case:

- `isRootSpecPath('tasks.md', mockCwd) === true`,
  `isRootSpecPath('./tasks.md', mockCwd) === true`.
- `isRootSpecPath('specs/2026-08-07-my-feature/tasks.md', mockCwd) ===
  false`.
- `isRootSpecBashCommand('touch tasks.md', mockCwd) === true`.
- `decide('Write', { file_path: 'tasks.md' }, mockCwd).blocked === true`.
- `decide('Write', { file_path: 'specs/2026-08-07-feature-auth/tasks.md'
  }, mockCwd).blocked === false`.

### 5. `tests/generate-skill.test.mjs`

No test changes needed — its existing "committed generated skill matches
template" assertion automatically covers the new content once step 2's
regeneration is committed. If step 1 lands without running the generator,
this test is what catches it (as designed).

## Verification Plan

### Automated Verification

- `node --test tests/*.mjs` — full suite (`bump-version`, `generate-skill`,
  `guard-push`, `guard-spec`) passes, including the new `tasks.md` cases
  and the regenerated-`SKILL.md` sync check.
- `node scripts/generate-skill.mjs --check` — confirms `SKILL.md` is in
  sync with the template (this is also what CI's `check-skill` job runs).

### Manual Verification

- Read the regenerated `skills/chowa-skill/SKILL.md` end to end: confirm
  the `### ` numbering in the Specification-Driven Pipeline area is
  sequential and no `chowa-only` content leaked in.
- Exercise the guard: attempt to `Write` a root-level `tasks.md` in a
  scratch check and confirm the hook denies it with the updated message,
  then confirm `specs/2026-08-13-speckit-inspired-stages/tasks.md` is
  allowed.
