# Implementation Plan: Cross-repo skill source of truth

Status: **Draft** — awaiting explicit approval before Stage 3 (code).

## Overview

Four phases, split across two repositories. Phases 1 and 2 are the real
engineering work and depend on each other in sequence (chowa's render step
needs something real to fetch); Phases 3 and 4 harden and document what's
already working.

| Phase | Delivers | Repo |
|---|---|---|
| 1 | The template + `chowa-skill`'s own generation tooling | `chowa-skill` |
| 2 | chowa's fetch + render pipeline, wired into `sync-skill.ts` | `chowa` |
| 3 | CI hardening (clear failure messages, pin-bump process) | Both |
| 4 | Docs recording the new relationship | Both |

**Recommendation:** land Phase 1 as its own PR into `chowa-skill`
first — it's independently useful (that repo gets real generated-file
discipline for the first time) and gives Phase 2 something concrete to
point at. Phase 2 is the biggest single unit of new code in `chowa`;
consider its own PR too, separate from Phase 3/4's hardening and docs.

## Phase 1: Template + `chowa-skill` Generation Tooling

**File: `templates/chowa-workflow.md`** (new, in `chowa-skill`)

Migrate `chowa-skill/SKILL.md`'s current content into template form. Every
paragraph/block gets exactly one tag:

```markdown
<!-- variant:shared -->
Prose or a code block true for both chowa and chowa-skill, verbatim.
<!-- variant:end -->

<!-- variant:chowa-only -->
Content that only makes sense where a CLI/bundled engine exists.
<!-- variant:end -->

<!-- variant:chowa-skill-only -->
Content specific to the pure-skill, tool-calls-only variant.
<!-- variant:end -->
```

Per the table in the spec's Resolved Question 2, this means splitting
several of `chowa-skill`'s current sections into multiple tagged blocks
rather than one — e.g. "PR Description Generation" becomes: `shared`
intro sentence, `chowa-skill-only` block with the `git log`/`gh pr create`
instructions, `shared` closing-line convention. Reconcile the drift here:
the closing-line paragraph is tagged `shared`, so it flows into both
outputs from one authored copy.

Content NOT in the template at all (stays only in `chowa-skill`'s
generated output, added directly by the generation script or kept as a
static suffix): the "What this skill intentionally does not do" section
and the "Quick Reference" table — these are `chowa-skill`-specific in a
way that doesn't need round-tripping through variant tags, since nothing
in chowa's render step needs to know they exist.

**File: `scripts/generate-skill.mjs`** (new, in `chowa-skill`)

```
Usage:
  node scripts/generate-skill.mjs          # write skills/chowa-skill/SKILL.md
  node scripts/generate-skill.mjs --check  # exit 1 if it would change
```

Reads the template, strips `chowa-only` blocks, unwraps `shared` and
`chowa-skill-only` blocks (remove the markers, keep the content), appends
the frontmatter and the two chowa-skill-only sections noted above,
writes the result. Mirrors `chowa`'s existing `scripts/sync-skill.ts`
closely enough that anyone familiar with one recognizes the other.

**File: `.github/workflows/ci.yml`** (new, in `chowa-skill` — no CI
exists there today)

A minimal workflow: install deps if any are added, run
`node scripts/generate-skill.mjs --check` on every PR. Keep this small;
this repo doesn't need `chowa`'s full quality-gate suite.

**Verification:** `node scripts/generate-skill.mjs`, diff the result
against the currently-committed `skills/chowa-skill/SKILL.md` — expect
only the closing-line reconciliation as a real content change; everything
else should be a lossless round-trip. Manually confirm the plugin still
installs and reads correctly (`/plugin install chowa-skill@chowa-skill`
in a scratch project, or at minimum a visual read-through).

## Phase 2: Chowa's Fetch + Render Pipeline

**File: `scripts/fetchSharedTemplate.ts`** (new, in `chowa`)

```ts
export interface FetchTemplateOptions {
  readonly sha?: string;       // defaults to the pinned constant below
  readonly timeoutMs?: number;
}

/** Fetches the raw template from the pinned commit. Throws a clearly
 *  labeled error distinguishing a network/fetch failure from an
 *  unexpected response (e.g. a 404 if the pin or path is wrong) — the
 *  two need different fixes and must not be reported the same way. */
export async function fetchSharedTemplate(options?: FetchTemplateOptions): Promise<string>;
```

`SHARED_TEMPLATE_SHA` lives as an exported constant in this file with a
comment explaining what it pins and how to bump it (point at the
`chowa-skill` commit that changed the template, re-run
`bun run sync:skill`, review the diff, commit both the pin bump and the
regenerated files together).

**File: `scripts/renderSharedVariant.ts`** (new, in `chowa`)

```ts
export type Variant = 'shared' | 'chowa-only' | 'chowa-skill-only';

/** Parses the `<!-- variant:X -->...<!-- variant:end -->` tags and
 *  returns the template with every block resolved for `keep` — unwrapped
 *  (markers removed, content kept) — and every other variant removed
 *  entirely. Throws on an unrecognized variant name or an unmatched
 *  start/end pair, same fail-loud precedent as sync-skill.ts's existing
 *  applySwap(). */
export function renderVariant(template: string, keep: readonly Variant[]): string;
```

Pure function, fully unit-testable against fixture template strings —
no network, no filesystem — mirroring how `sync-skill.ts`'s `toPortable`
is tested today.

**File: `scripts/sync-skill.ts`** (modified)

Gains a step before the existing region-swap logic:

1. `fetchSharedTemplate()` (or an injected override for tests).
2. `renderVariant(template, ['shared', 'chowa-only'])`.
3. Splice the result into chowa's existing document skeleton: the
   frontmatter, Step 0's chowa-specific signal list, and the fully
   chowa-only whole sections (Model Routing, Quota-Aware Session
   Auto-Resume, Claude Code Bridge, CLI Reference) are chowa-local content
   that was never part of the template — they get assembled around the
   rendered shared+chowa-only block, not extracted from it.
4. Continue into the existing `REGION_SWAPS` invocation/delegation/
   autoresume logic to produce the portable copy, exactly as today.

The exact splice points (where in chowa's skeleton the rendered block gets
inserted) are a straightforward mechanical mapping once Phase 1's template
exists — deferring the precise diff to Stage 3 rather than guessing it
here, since it depends on Phase 1's actual section boundaries.

**Verification:** `renderSharedVariant.test.ts` against fixture templates
(covering: keep-shared-only, keep-shared-and-chowa-only, unmatched
markers, unrecognized variant name). `fetchSharedTemplate.test.ts` with a
mocked `fetch` (success, network error, non-200 response) — no real
network calls in the automated suite. Regenerate chowa's three actual
skill files via the new pipeline and diff against current committed
content — expect no unintended changes.

## Phase 3: CI Hardening

- `chowa`'s `.github/workflows/ci.yml`: `check:skill`'s step output
  distinguishes "template fetch failed (network/pin issue)" from
  "generated content doesn't match what's committed (source drifted)" —
  two different fixes, two different messages.
- Confirm `check:skill` passes reliably across a handful of CI runs (no
  network-flakiness false failures) before calling this phase done, per
  the spec's acceptance criteria — this is the one criterion that can't
  be verified in a single run.
- `chowa-skill`'s new CI (Phase 1) gets the same treatment if it
  ever needs it, though it has no network dependency of its own.

## Phase 4: Docs

- `chowa`'s self-hosted `.claude/skills/chowa/SKILL.md`: a short note (in
  the existing "this file is not the distributed skill" callout, or
  nearby) that the canonical skill itself is now partially generated from
  `chowa-skill`, and where the pin lives.
- `chowa`'s README: mention the relationship in "How the plugin is
  distributed."
- `chowa-skill`'s README: note that `templates/chowa-workflow.md`
  is a dependency `chowa` syncs against now — a breaking change there
  breaks `chowa`'s next sync, not just this repo.

## Test Plan Summary

| Area | New tests |
|---|---|
| `chowa-skill/scripts/generate-skill.mjs` | Round-trip fixture template → generated file matches expected output |
| `renderSharedVariant.ts` | Keep-set combinations, unmatched markers, unrecognized variant name |
| `fetchSharedTemplate.ts` | Mocked fetch: success, network error, non-200 |
| `sync-skill.ts` (extended) | End-to-end: fixture template + chowa's local overlay content → expected canonical/portable output |

## Verification Checklist (Stage 3 exit criteria, per phase)

- [ ] Phase 1: `node scripts/generate-skill.mjs --check` clean; diff
      against pre-migration `skills/chowa-skill/SKILL.md` shows only the
      closing-line reconciliation as real content change.
- [ ] Phase 2: `bun test` covers `renderSharedVariant`/
      `fetchSharedTemplate` in isolation, no real network calls; the
      three regenerated chowa skill files diff clean against current
      committed content (mod nothing — Phase 1 already reconciled the one
      known drift).
- [ ] Phase 3: `check:skill` passes cleanly across several CI runs; a
      deliberately-broken pin produces the "fetch failed" message, not
      "content drifted."
- [ ] All phases: `bun run verify` clean.

## Rollout

Phase 1 first, as its own PR into `chowa-skill`. Once merged, pin
its commit SHA and start Phase 2 on a new `chowa` branch. Ask before
opening each phase's PR, same pattern as `session-ledger-autoresume`.
