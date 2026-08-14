# Implementation Plan: Roadmap Visualization Capability

- **Date**: 2026-08-09
- **Status**: Draft
- **Slug**: `roadmap-visualization`

## Proposed Changes

### 1. `templates/chowa-workflow.md`

Add a new `<!-- variant:shared -->` section titled `### Roadmap
Visualization`, placed after the existing `### PR Description Generation`
/ Visual Proof sections and before the ASD-STE100 section, documenting:

- **Trigger**: user asks to see/visualize the roadmap, or present the
  project's development history.
- **Data gathering**: read `specs/INDEX.md` first. Default to rich mode
  (also read each referenced `spec.md`'s Problem Statement/Goals sections);
  switch to lean mode automatically once the index has more than 20
  entries, or immediately if the user asked for something quick; ask
  directly whenever the mode is ambiguous.
- **Before building**: load the `artifact-design` skill for visual
  calibration — required before any Artifact publish.
- **Layout**: chronological timeline ordered by date, status color-coding
  (`Draft`, `Approved`, `In Progress`, `Done`, `Dismissed`, `Superseded by
  <link>`), a ⚠️ experimental marker surfaced from a spec's own
  `Stability` field when present, a status filter, and per-entry
  expand/collapse for the rich-mode narrative text.
- **Output**: publish via the `Artifact` tool and hand back the link — the
  generated HTML is never committed to the repo.

This is a `variant:shared` block (not `chowa-only`/`chowa-skill-only`)
because it needs only `Read` and `Artifact`, identical in both CLI and
skill modes — matching how the Visual Proof section is structured.

### 2. Skill Regeneration

Run `node scripts/generate-skill.mjs` to rebuild
`skills/chowa-skill/SKILL.md` from the updated template. Commit both the
template and generated file together (same pattern as every prior
template change in this repo).

### 3. `tests/generate-skill.test.mjs`

Add one test, following the existing `'generated skill requires a Visual
Proof section...'` pattern:

```js
test('generated skill documents Roadmap Visualization via Artifact and artifact-design', () => {
  const template = readFileSync(TEMPLATE, 'utf-8');
  const rendered = renderTemplate(template);

  assert.match(rendered, /### \d+\. Roadmap Visualization/);
  assert.match(rendered, /Artifact/);
  assert.match(rendered, /artifact-design/);
});
```

### 4. `specs/INDEX.md`

Row already present (added when the spec was drafted) — no change needed
here beyond what's already staged.

### 5. No new script/CLI change

Per the spec's non-goals: no `scripts/roadmap.mjs`, no `chowa roadmap`
subcommand. This is documentation-only — the capability lives entirely in
the workflow template Claude reads at runtime.

## Verification Plan

### Automated Verification

- `node --test tests/*.mjs` — full suite passes, including the new
  assertion.
- `node scripts/generate-skill.mjs --check` passes (generated file matches
  template render).

### Manual Verification

- Build one roadmap Artifact against this repo's own `specs/INDEX.md`
  (rich mode, since the index has well under 20 entries) to confirm the
  capability produces a real, well-designed, chronological, color-coded,
  filterable timeline — not just that the instructional text exists. This
  artifact is verification output, not a deliverable to commit.
