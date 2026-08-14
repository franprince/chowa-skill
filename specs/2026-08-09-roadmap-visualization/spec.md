# Specification: Roadmap Visualization Capability

- **Date**: 2026-08-09
- **Status**: Draft
- **Slug**: `roadmap-visualization`

## Problem Statement

Chōwa's spec → plan → execute pipeline accumulates a growing
`specs/INDEX.md` — a flat table of every feature ever specced, with a
status and a one-line summary. There is no way to see it as a story: what
shipped, what's in flight, what's still a draft, in what order. A
stakeholder (or a contributor coming back after time away) asking "what
has this project actually done, and where is it headed" has to read the
raw table by hand.

## Goals

1. **On-demand roadmap visualization** — when asked to visualize the
   roadmap or present a project's development history, Claude reads
   `specs/INDEX.md` (and, by default, each referenced `spec.md`) and
   produces a visually polished, self-contained HTML presentation via the
   `Artifact` tool.
2. **Chronological timeline layout** — entries ordered by date, each
   tagged/color-coded by status (`Draft`, `Approved`, `In Progress`,
   `Done`, `Dismissed`, `Superseded by <link>`), with an experimental
   marker (⚠️) surfaced for any spec whose own `Stability` field declares
   it.
3. **Two detail depths**:
   - **Rich** (default): pulls each spec's Problem Statement/Goals for
     narrative depth, suited to presenting development history to a
     stakeholder.
   - **Lean**: uses only the `Date | Slug | Status | Summary` row already
     in `specs/INDEX.md` — no per-spec file reads.
   Claude defaults to rich mode, switches to lean automatically once the
   index is large enough that reading every `spec.md` stops being worth
   it (more than 20 entries), and asks the user directly whenever which
   mode is wanted is ambiguous.
4. **Light interactivity**: a status filter and per-entry expand/collapse
   for the rich-mode narrative text, so the presentation reads well both
   collapsed (skimmable) and expanded (detailed).
5. **Real visual design effort**: this is explicitly meant to be
   presentation-quality, not a plain list — building it MUST go through
   the `artifact-design` skill first, per that skill's own requirement for
   any Artifact publish.
6. **No new persisted/committed script**: unlike `generate-skill.mjs` or
   `bump-version.mjs`, there is no static computation here worth unit
   testing standalone — the capability is Claude reading files and
   composing an Artifact on request, documented as workflow guidance.

## Non-Goals

- A committed, versioned HTML file living in the repo — the artifact is a
  live view of whatever `specs/INDEX.md` looks like when asked for, not a
  build output kept in sync.
- A `chowa roadmap` CLI subcommand — that would require changes to the
  separate CLI-backed `chowa` engine repository, out of scope here.
- Aggregating roadmaps across multiple projects/repos — this reads one
  project's own `specs/INDEX.md`.
- Automatic regeneration on every commit (e.g. via CI) — this is a
  request-driven presentation tool, not a dashboard that needs to always
  be fresh.

## Specification Details

### 1. Workflow Template (`templates/chowa-workflow.md`)

Add a new `<!-- variant:shared -->` section (works identically for CLI
and skill modes — it only needs `Read` and `Artifact`, no CLI command) titled
`### Roadmap Visualization`, documenting:

- **Trigger**: user asks to see/visualize the roadmap, or present the
  project's development history.
- **Data gathering**: read `specs/INDEX.md`. Default to rich mode (also
  read each referenced `spec.md`'s Problem Statement/Goals); switch to
  lean automatically above 20 entries, or immediately if the user asked
  for something quick; ask if ambiguous.
- **Before building**: load the `artifact-design` skill for visual
  calibration, per that skill's own requirement.
- **Layout**: chronological timeline, status color-coding, ⚠️ experimental
  marker from a spec's `Stability` field when present, status filter,
  per-entry expand/collapse in rich mode.
- **Output**: publish via the `Artifact` tool and hand back the link —
  don't commit the generated file to the repo.

### 2. Skill Re-generation

Rebuild `skills/chowa-skill/SKILL.md` via
`node scripts/generate-skill.mjs` so the new section is reflected there.

### 3. Tests

`tests/generate-skill.test.mjs` gets a new assertion that the rendered
template contains the `### Roadmap Visualization` heading and references
to both `Artifact` and `artifact-design`, matching the existing pattern
used for the Visual Proof section.

## Acceptance Criteria

1. `templates/chowa-workflow.md` has a `### Roadmap Visualization` shared
   section covering trigger, data gathering (rich/lean), the
   `artifact-design` skill load, layout, and output requirements above.
2. `skills/chowa-skill/SKILL.md` regenerated and matches the template
   render (`node scripts/generate-skill.mjs --check` passes).
3. `tests/generate-skill.test.mjs` updated with a passing assertion for
   the new section.
4. `specs/INDEX.md` has a row for this spec.
5. As verification (not committed), Claude actually builds one roadmap
   Artifact against this repo's own `specs/INDEX.md` to confirm the
   capability produces a real, well-designed result — not just that the
   instructional text exists.
