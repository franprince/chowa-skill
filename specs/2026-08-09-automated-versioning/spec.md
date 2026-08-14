# Specification: Automated Version Bumping for the Plugin Manifest

- **Date**: 2026-08-09
- **Status**: Done
- **Slug**: `automated-versioning`

## Problem Statement

`.claude-plugin/plugin.json`'s `version` field is bumped by hand, whenever a
contributor remembers to. History shows this drifts: two feature commits
(`727ad8f`, and the always-on/STE100 + Visual Proof work merged in PR #4)
landed with no version change at all, while `9818e88` bumped straight to
`0.2.0` as an afterthought bundled into an unrelated commit. There is no
script, CI check, or documented convention tying a merge to a version
change — it happens only when someone decides to do it.

A manually-maintained version number on a distributed plugin manifest is
unreliable: consumers (the Claude Code plugin marketplace, anyone pinning
a version) can't trust it reflects what actually shipped.

## Goals

1. **Fully automatic bump on merge to `main`** — no human picks a number.
   A GitHub Actions job computes the next version from Conventional Commit
   types accumulated since the last release tag and writes it to
   `.claude-plugin/plugin.json`.
2. **Zero new dependencies** — the repo has no `package.json` and no npm
   footprint today; the bump logic is a small `node`-only script in the
   same style as `scripts/generate-skill.mjs`, not `semantic-release` or
   `changesets`.
3. **Standard Conventional Commits bump mapping**:
   - `BREAKING CHANGE:` footer, or `!` after the type (e.g. `feat!:`) →
     **major**
   - else any `feat:` commit → **minor**
   - else any `fix:` commit → **patch**
   - else (only `docs`/`chore`/`style`/`refactor`/`test`/`ci`/`build`, or
     no conventional commits at all, since the last tag) → **no bump**,
     job is a no-op.
4. **Git tag as the source of truth for "last released version"** — the
   script diffs commits since the latest tag reachable from `HEAD`, not
   since some other bookkeeping file.
5. **One-time baseline**: tag current `main` as `v0.2.0` (matching today's
   `plugin.json`) before the automation goes live, so the first automated
   run has a real anchor to diff from.

## Non-Goals

- Changelog generation.
- Creating GitHub Release objects.
- Publishing to npm (there is nothing to publish — this is a Claude Code
  plugin, not an npm package).
- A per-PR "did you remember to bump" CI check — this spec makes that
  question moot by not requiring a human bump at all.
- Monorepo / multi-package version coordination.

## Specification Details

### 1. `scripts/bump-version.mjs`

A standalone Node script (no dependencies), mirroring the shape of
`scripts/generate-skill.mjs`:

- Exports pure, testable functions:
  - `classifyBump(commitMessages: string[]): 'major' | 'minor' | 'patch' | 'none'`
    — applies the precedence rules in Goal 3 across a list of raw commit
    subject+body strings.
  - `bumpSemver(current: string, level: 'major' | 'minor' | 'patch'): string`
    — increments the given part and zeroes everything below it (e.g.
    `bumpSemver('0.2.0', 'minor') === '0.3.0'`).
- CLI entry point:
  1. Run `git describe --tags --abbrev=0` to find the latest tag.
  2. Run `git log <tag>..HEAD --pretty=format:%s%n%b%n---COMMIT---` (or
     equivalent) to collect full commit messages (subject + body, so
     `BREAKING CHANGE:` footers are visible) since that tag.
  3. `classifyBump(...)` on the collected messages.
  4. If `'none'`: print a short message, exit `0`, do not touch
     `plugin.json`.
  5. Otherwise: read `.claude-plugin/plugin.json`, `bumpSemver(...)` its
     `version` field, write the file back (preserving existing
     formatting/trailing newline), and print the old and new version
     (e.g. `0.2.0 -> 0.3.0`) to stdout for the CI step to consume.

### 2. CI Wiring

A new job (in `.github/workflows/ci.yml` or a sibling `release.yml`),
triggered on `push: branches: [main]` — i.e. runs immediately after a PR
merges:

1. Checkout with `fetch-depth: 0` (full history and tags) and
   `permissions: contents: write`.
2. Configure a bot git identity (`github-actions[bot]`).
3. Run `node scripts/bump-version.mjs`.
4. If a bump was produced:
   - Commit `.claude-plugin/plugin.json` as
     `chore(release): vX.Y.Z [skip ci]`.
   - `git tag vX.Y.Z`.
   - Push the commit and the tag to `main`.
   - The `[skip ci]` marker (native GitHub Actions support) prevents that
     push from re-triggering this same workflow — no separate
     loop-prevention logic is needed.
5. If no bump was produced: the job exits cleanly with no commit, no tag,
   no push.

### 3. One-Time Baseline Tag

Before merging this feature, tag the current tip of `main` as `v0.2.0`
(matching the value already in `plugin.json`). This is a manual,
one-time action taken outside the automation — the automation itself
never needs to run without a prior tag to diff against.

## Acceptance Criteria

1. `scripts/bump-version.mjs` exists, exports `classifyBump` and
   `bumpSemver`, and has a CLI entry point that performs the read/compute/
   write flow described above.
2. `tests/bump-version.test.mjs` covers `classifyBump` (major/minor/patch/
   none cases, including a `BREAKING CHANGE:` footer and a `feat!:`
   subject) and `bumpSemver` (each of major/minor/patch resets lower
   components to zero), and passes under `node --test`.
3. CI workflow file updated with the new `push: branches: [main]` job,
   wired to run `bump-version.mjs` and commit/tag/push only when a bump
   was produced.
4. `v0.2.0` tag exists on `main`, created before this feature merges.
5. `specs/INDEX.md` has a row for this spec.
