# Spec: PR templates by branch flow (standard / feature / release)

Status: **Approved** — original two open questions resolved as proposed:
(1) single `rolloutPlan` field, not split into `rolloutPlan`/
`rollbackPlan`; (2) `branchName` is a required parameter on
`generatePRDescription`, no default. **Amended** after initial
implementation (PR #10, not yet merged) to pull `feat/*` out of
`standard` into its own `feature` type — see Amendment below.

## Problem Statement

`chowa pr --base <branch>` (`generatePRDescription` in
`src/git/prDescription.ts`) always produces the same four-section shape —
Summary, Changes, Testing Notes, Breaking Changes — no matter what kind of
PR it is. The branch-flow convention Chōwa already documents and expects
every consumer project to follow (`fix/*`, `feat/*`, `docs/*`, `chore/*`
etc. → `develop`; `release/*` and `hotfix/*` → `main`) has no structural
reflection in the generated description. A release/hotfix PR — which needs
a rollout/rollback plan reviewers can act on — reads identically to a
routine docs fix, and a new-capability `feat/*` PR reads identically to a
one-line `chore/*` bump.

### Amendment: `feat/*` gets its own template

The first pass (this spec's original G1/G2) only split `release`/`hotfix`
out from everything else, leaving `feat/*` lumped into `standard` with
`fix`/`docs`/`chore`/etc. That undersells feature PRs: a new capability
needs the reviewer to know *why it exists* and *how it reaches users*
(flag-gated? gradual? docs to update?) — neither of which a one-line
`chore` bump needs. `fix/*` stays in `standard` (a bugfix template is out
of scope here); only `feat/*` is pulled out.



This is a portable gap, not a self-dev one: any project that installs
Chōwa and calls `chowa pr` (via the CLI or the Claude Code bridge's `pr`
action) hits the same one-size-fits-all output. Fixing it in
`generatePRDescription` fixes it for every consumer at once, without
needing `chowa.config.ts` (which, per `specs/2026-08-01-routing-config-wiring/`,
isn't actually loaded yet — so a config-driven template registry would be
inert today).

## Goals

- **G1.** Classify the current branch into a PR type using branch
  prefixes: `release/*` and `hotfix/*` → `release`; `feat/*` → `feature`;
  everything else (`fix/*`, `docs/*`, `chore/*`, no-prefix, unrecognized)
  → `standard` (default/fallback).
- **G2.** Give the `release` type one additional required section — a
  rollout/rollback plan — that `standard` does not have. All types keep
  Summary, Changes (derived from commits, unchanged), Testing Notes, and
  optional Breaking Changes.
- **G2b (amendment).** Give the `feature` type its own additional
  required section — rollout notes (is this flag-gated? gradual rollout?
  does documentation need updating?) — lighter-weight than `release`'s
  rollout/rollback plan, which is deploy-and-recovery focused. Also tune
  the `feature` system prompt so `summary` frames *why this capability
  exists / who it's for*, not just what changed — `standard` and
  `release` keep the existing "explain the WHY" guidance unchanged.
- **G3.** Wire classification into every call site that builds a PR
  description: `handlePR` in `src/cli.ts`, and `handlePR` in both
  `src/integrations/claude-code/bridge.ts` and
  `src/integrations/antigravity/bridge.ts` — all already fetch or can
  cheaply fetch the current branch name via `GitOps.getCurrentBranch()`.
- **G4.** No config file, no new CLI flag: classification is derived
  purely from the branch name Git already reports, so it works the same
  in this repo and in any consumer project on day one.

## Non-Goals

- Not adding `.github/PULL_REQUEST_TEMPLATE/*.md` files — explicitly
  deferred; this spec covers Chōwa's own `pr` command output only.
- Not giving `fix/*` its own template — it stays in `standard` alongside
  `docs/*`/`chore/*`/etc. Only `feat/*` (feature) and
  `release/*`+`hotfix/*` (release) are pulled out as distinct types.
- Not making templates configurable via `chowa.config.ts` — blocked on
  the routing-config-wiring gap; convention-based detection ships now,
  configurability can be a follow-up once config loading actually works.
- Not changing `chowa commit` / commit message generation.
- Not changing the `changes` section's derivation (still verbatim commit
  messages) or the Breaking Changes section's semantics.

## Affected Interfaces

- `src/git/types.ts`: `PRType` becomes `'standard' | 'feature' |
  'release'`. `PRDescription` gains `readonly rolloutNotes?: string`
  (present only when `type === 'feature'`), alongside the existing
  `readonly rolloutPlan?: string` (present only when `type ===
  'release'`) — the two are deliberately separate fields, not a shared
  one, since a feature's rollout notes and a release's rollback plan
  answer different questions and a PR is never both types at once.
- `src/git/prDescription.ts`:
  - `detectPRType(branchName: string): PRType` — prefix match, checked in
    order: `release/` / `hotfix/` → `release`; `feat/` → `feature`; else
    → `standard`.
  - Three system prompts: `STANDARD_PR_SYSTEM_PROMPT` (unchanged),
    `RELEASE_PR_SYSTEM_PROMPT` (unchanged, asks for `rolloutPlan`), new
    `FEATURE_PR_SYSTEM_PROMPT` (asks for `rolloutNotes`, and tunes the
    `summary` instruction toward motivation/user-impact framing).
  - `generatePRDescription` selects the prompt by `detectPRType(branchName)`
    and sets `rolloutNotes` (with its own fallback string) only when
    `type === 'feature'`, mirroring the existing `rolloutPlan` handling
    for `release`.
- `src/cli.ts` (`handlePR`): extend the console output to also print a
  `## Rollout Notes` section when `pr.type === 'feature'` (alongside the
  existing `## Rollout / Rollback Plan` section for `release`).
- `src/integrations/claude-code/bridge.ts` / `antigravity/bridge.ts`: no
  further change beyond what already shipped — both already forward the
  full `prDescription` object, so `rolloutNotes` reaches consumers for
  free.
- `tests/git/prDescription.test.ts`: extend with `detectPRType('feat/foo')
  === 'feature'` and `generatePRDescription` cases for the `feature` type
  (with and without a well-formed `rolloutNotes` in the mock response).

## Edge Cases

- Branch name with no recognized prefix (`main`, `my-experiment`) →
  `standard`, identical to today's output. This is the fallback, not an
  error.
- `hotfix/*` branching from `main` directly (per the documented exception
  in the branch-flow rule) still classifies as `release` — classification
  reads the current branch's own prefix, not the base branch argument.
- LLM omits `rolloutPlan`/`rolloutNotes` in a malformed/non-JSON response
  for a `release`/`feature`-type PR respectively: falls back to a fixed
  default string per type (mirroring the existing fallback pattern for
  `summary`/`testing`), never throws.
- A branch prefixed both ways is impossible (`release/feat-x` matches
  `release/` first per the checked-in-order match — release always wins
  over feature if a prefix were ever nested, though this isn't an
  expected real branch name).
- Case sensitivity: match prefixes case-sensitively (`Feat/*`/`Release/*`
  are not recognized prefixes) — consistent with Git's own case-sensitive
  ref naming and the branch-flow doc's lowercase convention.

## Acceptance Criteria

- [ ] `detectPRType('release/1.4.0')` and `detectPRType('hotfix/login-500')`
      return `'release'`; `detectPRType('feat/foo')` returns `'feature'`;
      `detectPRType('fix/bar')`, `detectPRType('docs/baz')`,
      `detectPRType('chore/x')`, `detectPRType('main')`,
      `detectPRType('random-name')` return `'standard'`.
- [ ] `generatePRDescription(commits, diff, client, policy, 'fix/bar')`
      returns `type: 'standard'`, no `rolloutPlan`, no `rolloutNotes`.
- [ ] `generatePRDescription(commits, diff, client, policy, 'feat/foo')`
      returns `type: 'feature'` and a non-empty `rolloutNotes`, no
      `rolloutPlan`.
- [ ] `generatePRDescription(commits, diff, client, policy, 'release/1.4.0')`
      returns `type: 'release'` and a non-empty `rolloutPlan`, no
      `rolloutNotes`.
- [ ] `bun run src/cli.ts pr --base develop` run from a `fix/*` branch
      prints the current 4-section output (no rollout section).
- [ ] `bun run src/cli.ts pr --base develop` run from a `feat/*` branch
      prints a `## Rollout Notes` section.
- [ ] `bun run src/cli.ts pr --base main` run from a `release/*` or
      `hotfix/*` branch prints a `## Rollout / Rollback Plan` section.
- [ ] Claude Code bridge and Antigravity bridge `pr` action responses
      (`data.prDescription`) reflect `type` and the type-appropriate
      rollout field.
- [ ] `bun test`, `bun run check:imports`, `bun run build` all pass.

## Decisions

1. Single `rolloutPlan` field for `release` (not split into
   `rolloutPlan` + `rollbackPlan`) — covers both "how this goes out" and
   "how to undo it" in one prompt/field.
2. `branchName` is a required parameter on `generatePRDescription` — all
   call sites must pass it explicitly; no implicit `'standard'` default
   that a future call site could silently fall into.
3. (Amendment) `feature` gets its own `rolloutNotes` field, separate from
   `release`'s `rolloutPlan` — motivated by "Motivation + Rollout notes"
   framing rather than a shared field, since the two types ask
   fundamentally different questions.
4. (Amendment) Only `feat/*` is pulled out of `standard`; `fix/*` stays —
   a distinct bugfix template is out of scope for this spec.
