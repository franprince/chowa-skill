# Implementation Plan: Portable global skill sync

Status: **Done** — 2026-08-01. Branch: `fix/portable-global-skill-sync`
(off `develop`, per this repo's branch-flow rule). Both commits landed;
`bun test` (98/98), `bun run lint`, `bun run check:imports`, and
`bun run build` all clean. Manually verified with a scratch `$HOME` that
`chowa check-update` no longer touches `~/.gemini/config/` while
`chowa sync-global` still writes both files with the corrected content.

## Overview

Three independent changes, landed as separate atomic commits:

1. Remove the implicit `handleSyncGlobal()` call from `handleCheckUpdate()`
   in `src/cli.ts` (G1).
2. Correct the hardcoded `globalAgentsContent` string `handleSyncGlobal()`
   writes, so it no longer asserts a blanket "applies to all projects"
   claim (G3).
3. Rewrite `.agents/skills/chowa/SKILL.md` with the same self-repo /
   consumer / not-installed mode-detection already applied to
   `~/.claude/skills/chowa/SKILL.md` this session (G2).

Order: 1 and 2 both touch `src/cli.ts` and are small enough to land as one
commit; 3 is a pure doc change and stands alone.

## 1 & 2. `src/cli.ts` — decouple sync-global from check-update, fix its content

**File: `src/cli.ts`**

Remove line 105 (`await handleSyncGlobal();`) from `handleCheckUpdate()`:

```diff
 async function handleCheckUpdate(baseBranch?: string): Promise<void> {
   const { GitOps } = await import('./git/gitOps.js');
   const gitOps = new GitOps();

-  await handleSyncGlobal();
-
   const status = await gitOps.checkRemoteUpdates('origin', baseBranch);
```

`handleSyncGlobal()` itself, and the `case 'sync-global':` branch in
`main()`, are untouched structurally — `sync-global` remains a fully
functional, explicit command.

Update `globalAgentsContent` (lines 89-93) to drop the blanket claim:

```diff
     const globalAgentsFile = join(globalConfigDir, 'AGENTS.md');
     const globalAgentsContent = `# Global Chōwa Workspace Rules

-- Use the \`chowa\` skill for all branching, commit, PR, routing, quality, and architecture conventions across all projects.
-- Never push directly to \`main\`, \`master\`, or \`develop\`. Always work on dedicated feature branches and ask user before creating PRs.
+- In any project that has Chōwa installed (as its own source, or as a
+  dependency), use the \`chowa\` skill for branching, commit, PR, routing,
+  and quality conventions.
+- Never push directly to \`main\` or \`master\`. Always work on dedicated
+  feature branches and ask the user before creating PRs.
 `;
```

Also update the module doc-comment at the top of `handleSyncGlobal` region
if it references "syncs global config" as part of check-update — check
`printHelp()` and the top-of-file comment block (lines 3-14) for any stale
mention; none currently reference sync-global, so likely no change needed
there, confirm during implementation.

**Verification:**
- Manual: run `bun run src/cli.ts check-update` in a scratch copy with a
  pre-existing `~/.gemini/config/AGENTS.md` (or a temp `HOME`), confirm the
  file's mtime doesn't change.
- Manual: run `bun run src/cli.ts sync-global` directly, confirm it still
  writes both files with the corrected `AGENTS.md` content.
- `bun test`, `bun run check:imports`, `bun run build` stay clean (no
  behavioral surface touched other than the removed call and a string
  literal — no test currently covers `cli.ts`, confirmed during spec
  research).

## 3. `.agents/skills/chowa/SKILL.md` — mode detection

Rewrite using the same three-mode structure as `~/.claude/skills/chowa/SKILL.md`
(already fixed this session), adapted to be provider-neutral prose (this
file is read directly by anyone working in the repo without Claude Code,
and is what `sync-global` copies into `~/.gemini/config/skills/chowa/SKILL.md`):

- **Step 0: Detect mode** — self-repo (`package.json` name `chowa` +
  `src/cli.ts` + `chowa.config.ts`) / consumer (`chowa` in
  dependencies, or `node_modules/.bin/chowa`) / not-installed (say so,
  defer to the project's existing conventions, stop).
- Keep the existing workflow rules (spec→plan→execute, branching per this
  repo's `develop`/`main` flow, commit conventions, quality gates, model
  routing) but phrase commands as `chowa <command>` shorthand — substitute
  `bun run src/cli.ts <command>` in self-repo mode or `npx chowa <command>`
  /`bunx chowa <command>` in consumer mode, matching what was done for the
  Claude Code file.
- §5 (quality verification) in consumer mode defers to the *consumer
  project's* own test/lint/build scripts, not `bun test`/`check:imports`/
  `build` — those are Chōwa's own internal gates.
- Do not carry over anything specific to Chōwa's own current backlog (no
  "Known Gap"-style section) — this file's job is portability once synced
  elsewhere.
- The `sync-global`/`check-update` reference table entry updates to note
  `sync-global` is explicit-only (reflecting the §1/2 fix above).

No change to `.claude/skills/chowa/SKILL.md` (project-local) or `.agents/AGENTS.md`
— both correctly scoped to this repo already.

**Verification:** manual read-through; no automated test for a doc file.
Confirm the rewritten file still gives correct, unchanged-in-substance
instructions when read from Chōwa's own repo (self-repo branch).

## Test Plan Summary

| Area | New/changed tests |
|---|---|
| `handleCheckUpdate` no longer calls sync | manual verification (no existing test harness for `cli.ts`) |
| `handleSyncGlobal` content | manual verification |
| `.agents/skills/chowa/SKILL.md` | manual read-through |

No new automated tests — this change is CLI wiring + doc content, and
`cli.ts` has no existing test coverage to extend (confirmed absent during
spec research: `grep` for `sync-global`/`handleCheckUpdate` under `tests/`
returned nothing).

## Verification Checklist (Stage 3 exit criteria)

- [ ] `bun test` — all pass, unchanged count
- [ ] `bun run check:imports` — clean
- [ ] `bun run build` — clean
- [ ] `bun run lint` — clean
- [ ] Manual: `chowa commit`/`chowa pr`/`chowa check-update` leave
      `~/.gemini/config/` untouched
- [ ] Manual: `chowa sync-global` still writes both files correctly

## Rollout

Two commits on `fix/portable-global-skill-sync` (branched from `develop`,
per this repo's branch-flow rule): one for the `src/cli.ts` decoupling +
content fix, one for the `.agents/skills/chowa/SKILL.md` rewrite. Ask the
user before opening a PR (target: `develop`).
