# Implementation Plan: Storybook Before/After Visual Proof Tool

- **Date**: 2026-08-14
- **Status**: Draft
- **Slug**: `storybook-visual-proof-tool`

## Proposed Changes

### 1. `scripts/storybook-proof.mjs` (new)

Plain Node script (no new dependency for chowa-skill itself), mirroring
the shape of `guard-spec.mjs` / `bump-version.mjs`: pure, exported,
testable functions plus a CLI entry point guarded by the
`import.meta.url === 'file://' + process.argv[1]` main-module check.

**Pure functions:**

- `resolveStoryFilesFromDiff(changedFiles, exists)` — for each changed
  file: if it's already `*.stories.{js,jsx,ts,tsx,mdx}`, include it
  directly; else probe sibling paths (`<dir>/<basename>.stories.<ext>`
  for each known extension, via the injected `exists(path)` check so this
  stays unit-testable without real disk I/O) and include the first match.
  Returns a deduplicated list of story file paths.
- `extractStoryIdsFromSource(source)` — regex-extracts the CSF `title:
  ['"](.+?)['"]` and every `export const <Name>` (excluding `default`)
  from a story file's source text, and computes each story's ID using
  Storybook's own slugification rule (lowercase, non-alphanumeric → `-`,
  trimmed, `<title-slug>--<export-name-slug>`). This is a regex-level
  approximation of Storybook's `toId()` — documented as a known
  limitation: non-standard CSF (dynamic titles, `storyName` overrides)
  isn't resolved and falls back to the `--stories`/`--all` CLI overrides
  already in the spec.
- `classifyStories(baseIds, headIds)` — set comparison: IDs in both →
  `'changed'`, IDs only in `headIds` → `'new'`, IDs only in `baseIds` →
  `'removed'`.
- `buildComparisonTable(entries)` — `entries: { id, status, beforePath?,
  afterPath? }[]` → the Markdown table from the spec, handling all four
  row states: normal (`![Before]`/`![After]`), `'new'` (`*N/A (New
  Component)*` in Before), `'removed'` (`*N/A (Removed)*` in After), and
  `'failed'` (screenshot capture threw — both columns read `*screenshot
  failed*`, matching the per-story failure isolation already established
  for the sibling `visual-proof.mjs` design conversation, applied here
  too since a hung Storybook story shouldn't abort the whole run).

**CLI entry point:**

1. Parse `--base <ref>` (required), `--stories <ids>` (comma-separated
   override), `--all`, `--port <number>`.
2. **Preconditions** (fail loud, before any process spawns):
   - `.storybook/main.{js,ts,cjs,mjs}` exists → else exit pointing at
     setting up Storybook first.
   - `npx playwright --version` resolves → else exit pointing at adding
     it as a devDependency. (Screenshots shell out to the target
     project's own `npx playwright screenshot <url> <out>`, not a
     Playwright library import — keeps this repo dependency-free, same
     principle as §4 Code Quality deferring to "the project's own
     test/lint/build scripts.")
   - `git rev-parse --verify <base>` succeeds → else exit pointing at
     fetching it first.
3. **Resolve the target spec directory** — match the current branch
   name's slug (the part after the last `/`) against
   `specs/<YYYY-MM-DD>-<slug>/` directory names. Exactly one match →
   proof images go to `specs/<match>/proof/`. Zero or multiple matches →
   exit asking for an explicit `--out-dir <path>`. (This resolves a gap
   the spec's final draft left implicit — the original scoping draft
   called it "Identifying the Active Spec Directory" but the approved
   version didn't specify the mechanism.)
4. **Identify target stories**: `git diff --name-only <base>...HEAD`,
   filtered to component/story extensions, through
   `resolveStoryFilesFromDiff`. `--stories`/`--all` bypass this step
   entirely, per the spec's CLI Options.
5. **Capture "Before"**:
   - `git worktree add <tmpdir> <base>`.
   - For each target story file, `git show <base>:<path>` for its
     content → `extractStoryIdsFromSource` (a file absent at `<base>`
     yields no base IDs — all its stories are `'new'` by construction).
   - Allocate one free port (`node:net`, bind port `0`, read the assigned
     port, close), unless `--port` was given.
   - `npx storybook dev -p <port> --ci` in `<tmpdir>`, poll
     `http://localhost:<port>/iframe.html` until it responds (bounded
     retry loop, default 30s timeout).
   - Per base story ID: `npx playwright screenshot
     "http://localhost:<port>/iframe.html?id=<id>&viewMode=story"
     <out-dir>/<id>-before.png`, wrapped in a per-story try/catch — a
     failure marks that entry `'failed'` and capture continues.
   - Kill the Storybook process, `git worktree remove --force <tmpdir>`.
6. **Capture "After"**: same as step 5 but directly in the current
   working tree (no worktree), reading story source straight off disk,
   writing `<out-dir>/<id>-after.png`.
7. **Classify & render**: `classifyStories(baseIds, headIds)`, resolve
   each entry's screenshot paths by status, `buildComparisonTable(...)`,
   print to stdout and also write it to
   `<out-dir>/../visual-proof-snippet.md` for easy copy-paste into
   `spec.md`'s or the PR's `### Visual Proof` section.
8. **Teardown on interruption**: register `SIGINT`/`SIGTERM` handlers
   that kill any still-running Storybook process and remove any pending
   worktree before exiting, so a Ctrl-C mid-run doesn't leave orphaned
   processes or worktrees behind.

### 2. `tests/storybook-proof.test.mjs` (new)

- `resolveStoryFilesFromDiff`: a changed `.stories.tsx` file is included
  directly; a changed `Button.tsx` resolves to `Button.stories.tsx` when
  the injected `exists()` reports it present; a changed file with no
  sibling story file is excluded; duplicate resolutions are deduplicated.
- `extractStoryIdsFromSource`: a fixture CSF string with a `title` and
  three named exports (`Primary`, `Secondary`, `default`) yields exactly
  two IDs (`default` excluded), correctly slugified (e.g. title `"Forms/
  Button"` + export `Primary` → `forms-button--primary`).
- `classifyStories`: base `{a,b}` / head `{b,c}` → `a` removed, `b`
  changed, `c` new.
- `buildComparisonTable`: one entry of each status (`changed`, `new`,
  `removed`, `failed`) renders the four row shapes from the spec exactly,
  including the `*N/A (New Component)*` / `*N/A (Removed)*` / `*screenshot
  failed*` markers.

No real Storybook or Playwright process is invoked in this repo's own
test suite — chowa-skill has no Storybook to test against, same caveat
noted for the sibling tool design earlier in this session.

### 3. `templates/chowa-workflow.md`

Add a new `shared` block documenting the command as an **on-request**
tool — not wired into §8's automatic Visual Proof trigger — placed
directly after the PR Description Generation / Visual Proof block:

```markdown
### Storybook Before/After Visual Proof (On-Request)

When the user explicitly asks for visual proof of a Storybook-backed
UI change (not automatically, and not implied by a diff merely touching
styling files), run:

\`\`\`bash
node scripts/storybook-proof.mjs --base <base-ref>
\`\`\`

Requires the target project to already have Storybook and Playwright
configured — the script exits with a clear message if either is
missing rather than attempting to install them. Its output is a
ready-to-paste Markdown before/after table for the `### Visual Proof`
PR section.
```

### 4. `skills/chowa-skill/SKILL.md` (generated)

Run `node scripts/generate-skill.mjs` after step 3 lands — never
hand-edited.

## Verification Plan

### Automated Verification

- `node --test tests/*.mjs` — full suite passes, including the new
  `storybook-proof.test.mjs` cases.
- `node scripts/generate-skill.mjs --check` — confirms `SKILL.md` is in
  sync with the template.

### Manual Verification

- Not exercisable end-to-end inside chowa-skill's own repo (no Storybook
  here). Once merged, do one real run against an external Storybook-
  enabled project to confirm: worktree lifecycle leaves no residue after
  a normal run and after a `Ctrl-C` mid-run, the free-port allocation
  doesn't collide with an already-running Storybook instance, and the
  generated Markdown table renders correctly in a PR description.
