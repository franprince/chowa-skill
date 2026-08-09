# Implementation Plan: Automated Version Bumping for the Plugin Manifest

- **Date**: 2026-08-09
- **Status**: Draft
- **Slug**: `automated-versioning`

## Proposed Changes

### 1. `scripts/bump-version.mjs` (new)

- Pure, exported functions:
  - `classifyBump(commitMessages: string[])` — regex-matches each message's
    subject line against `^(\w+)(\(.+\))?(!)?:`; scans full message text
    for a `BREAKING CHANGE:` footer. Returns `'major'` if any breaking
    marker found, else `'minor'` if any `type` is `feat`, else `'patch'`
    if any `type` is `fix`, else `'none'`.
  - `bumpSemver(current: string, level: 'major'|'minor'|'patch')` — splits
    on `.`, increments the matching index, zeroes the rest.
- CLI entry point (guarded by `import.meta.url === ` main-module check,
  same pattern as `generate-skill.mjs`):
  1. `execSync('git describe --tags --abbrev=0')` for the last tag.
  2. `execSync('git log <tag>..HEAD --pretty=...')` for commit messages
     since that tag, split into an array of full messages.
  3. `classifyBump(...)`.
  4. `'none'` → log and exit 0.
  5. Otherwise read `.claude-plugin/plugin.json`, `JSON.parse`, bump
     `version`, `JSON.stringify` back with 2-space indent + trailing
     newline (matching current file style), write it, log
     `"<old> -> <new>"`.

### 2. `tests/bump-version.test.mjs` (new)

- `classifyBump`: cases for a plain `feat:` → minor, plain `fix:` →
  patch, `feat!:` → major, a `fix:` message with a `BREAKING CHANGE:`
  footer → major, only `chore:`/`docs:` → none, empty array → none, and
  major-beats-minor-beats-patch precedence when multiple types are mixed
  in one batch.
- `bumpSemver`: `('1.2.3', 'patch') → '1.2.4'`, `('1.2.3', 'minor') →
  '1.3.0'`, `('1.2.3', 'major') → '2.0.0'`.

### 3. CI Workflow (`.github/workflows/ci.yml`)

Add a second job, `release`, alongside the existing `check-skill` job:

```yaml
release:
  needs: check-skill
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  permissions:
    contents: write
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - run: node scripts/bump-version.mjs
      id: bump
    - name: Commit and tag
      if: steps.bump.outputs.bumped == 'true'
      run: |
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git add .claude-plugin/plugin.json
        git commit -m "chore(release): v${{ steps.bump.outputs.version }} [skip ci]"
        git tag "v${{ steps.bump.outputs.version }}"
        git push origin HEAD:main --follow-tags
```

`bump-version.mjs`'s CLI entry point writes `bumped` and `version` to
`$GITHUB_OUTPUT` (falls back to plain stdout when that env var is unset,
so it stays runnable/testable locally).

`needs: check-skill` keeps the release job from tagging a version whose
tests didn't pass; `if: ... push ... main` keeps it from running on PRs.

### 4. One-Time Baseline Tag

After this PR is reviewed (not blocked on merge — can happen any time
before the automation's first real run): `git tag v0.2.0 <main-tip-sha>
&& git push origin v0.2.0`. Called out here as a manual follow-up step,
not something the plan's code changes perform.

## Verification Plan

### Automated Verification

- `node --test tests/*.mjs` — new `bump-version.test.mjs` cases pass
  alongside the existing suite.
- `node scripts/bump-version.mjs` run locally against this repo's actual
  history once `v0.2.0` is tagged, to confirm it correctly reports
  `'none'` (this plan's own commits are `docs`/`feat`... — actually will
  correctly report `'minor'` once the `feat(...)` implementation commit
  lands, which is expected, not a bug).

### CI Verification

- Not unit-testable: confirmed by observation after the first real merge
  to `main` post-baseline-tag — the `release` job should either bump and
  tag, or no-op, matching the merged commits' types.
