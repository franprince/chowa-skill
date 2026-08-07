# Spec: Portable global skill sync (stop leaking self-dev instructions into other projects)

Status: **Done** — 2026-08-01. Implemented on branch
`fix/portable-global-skill-sync`. Both open questions resolved as proposed:
(1) removed the implicit `handleSyncGlobal()` call from `handleCheckUpdate()`
entirely, no flag; (2) made `.agents/skills/chowa/SKILL.md` provider-neutral
with the same mode-detection structure as the Claude Code skill.

## Problem Statement

External feedback (via a Claude Code session run against an unrelated
project, `agentic-media-bot`) reported that the *global* Chōwa skill for
Claude Code (`~/.claude/skills/chowa/SKILL.md`) recited Chōwa's own internal
dev workflow — `bun run src/cli.ts commit`, `chowa.config.ts`, `bun run
check:imports`, even a "Known Gap" describing Chōwa's own in-flight bug —
as if it were universal, with no check for whether the current project is
actually Chōwa's own source. That file has already been fixed by hand this
session (mode-detection added: self-repo / consumer-with-chowa-installed /
not-installed), fixing the reported symptom.

Auditing how that file got into its broken state surfaced the same defect
live in shipped code, not just a stale doc copy:

1. **`.agents/skills/chowa/SKILL.md`** (`src/cli.ts`'s `handleSyncGlobal`
   source file) is the same kind of self-dev-only, first-person document —
   no mode detection, assumes it's always running inside Chōwa's own repo.
2. **`handleSyncGlobal()`** (`src/cli.ts:73-99`) copies that file verbatim
   to `~/.gemini/config/skills/chowa/SKILL.md`, and unconditionally
   overwrites `~/.gemini/config/AGENTS.md` with a hardcoded blanket
   statement ("Use the chowa skill for all... conventions across all
   projects") — regardless of which project it's invoked from.
3. **`handleCheckUpdate()`** (`src/cli.ts:101-115`) calls
   `handleSyncGlobal()` unconditionally, and `handleCheckUpdate` is itself
   called by `handleCommit` and `handlePR` (`src/cli.ts:125`, `:154`). So
   *every* `chowa commit`, `chowa pr`, or `chowa check-update` invocation —
   in Chōwa's own repo or, once published, in any consumer project that
   depends on `chowa` — silently overwrites two files under the user's home
   directory as an undocumented side effect of an unrelated command.

In Chōwa's own repo today, step 3 means every commit workflow re-poisons
`~/.gemini/config/` with self-dev-only instructions and a false "applies to
all projects" claim — a repeatable version of the exact bug reported for
Claude Code, just for Gemini, and currently live in this repo's own
`git log` (every `check-update`/`commit`/`pr` run since `sync-global` was
introduced).

## Goals

- **G1.** `chowa commit`, `chowa pr`, and `chowa check-update` no longer
  have the side effect of writing to `~/.gemini/config/`. Global sync stays
  available only as the explicit `chowa sync-global` command its name
  already promises.
- **G2.** `.agents/skills/chowa/SKILL.md` — the file `sync-global` copies —
  gets the same mode-detection treatment already applied to
  `~/.claude/skills/chowa/SKILL.md`: self-repo / consumer-with-chowa /
  not-installed, so if a consumer project ever runs `chowa sync-global`
  itself, the copied skill doesn't recite Chōwa's own internal workflow.
- **G3.** The hardcoded `~/.gemini/config/AGENTS.md` content `sync-global`
  writes stops asserting "use chowa for all conventions across all
  projects" as an unconditional global truth from a single invocation;
  it should describe what actually holds (Chōwa's conventions apply in
  projects that have Chōwa set up) rather than a blanket claim.
- **G4.** No change in behavior for anyone who explicitly runs
  `chowa sync-global` today, other than the corrected content.

## Non-Goals

- Not removing `sync-global` or the Gemini-sync feature entirely — just
  fixing what it does and when it runs.
- Not re-touching `~/.claude/skills/chowa/SKILL.md` or the project-local
  `.claude/skills/chowa/SKILL.md` — both already handled this session and
  out of scope here.
- Not adding a generalized "which AI tool am I" detection framework —
  reusing the same three-mode check (self-repo / consumer / not-installed)
  already written for the Claude Code skill is enough.
- Not adding new CLI flags (e.g. `--skip-sync`) — removing the implicit
  call from `handleCheckUpdate` is a strictly better fix than making the
  side effect optional but still on-by-default.
- Not changing `handleCheckUpdate`'s actual remote-update-check behavior
  (`gitOps.checkRemoteUpdates`) — untouched.

## Affected Interfaces

- `src/cli.ts`: remove the `await handleSyncGlobal();` call inside
  `handleCheckUpdate()` (line 105). `handleSyncGlobal` itself and the
  `sync-global` CLI subcommand (`case 'sync-global'`) stay as the sole,
  explicit entry point.
- `src/cli.ts`: update the hardcoded `globalAgentsContent` string inside
  `handleSyncGlobal()` (lines 89-93).
- `.agents/skills/chowa/SKILL.md`: rewritten with the same mode-detection
  structure as `~/.claude/skills/chowa/SKILL.md` (Step 0 guard clause +
  branching instructions), adapted to be provider-neutral (this file is
  consumed by both the Gemini sync path and read directly by anyone
  working in this repo without Claude Code).
- `.claude/skills/chowa/SKILL.md` (project-local, committed in this repo):
  no change — it's correctly scoped to only load when working in Chōwa's
  own repo, so self-dev-specific content there is appropriate.
- `README.md`: no change expected, but check whether it documents
  `sync-global` as running automatically — if so, update that claim too.

## Edge Cases

- User already has a hand-written `~/.gemini/config/AGENTS.md` before ever
  running `chowa sync-global` — out of scope to change: `sync-global`'s
  entire purpose is to make that file chowa-managed, and that's an explicit
  action the user took by running the command. The fix here is about *when*
  it runs (only on explicit invocation), not making the overwrite itself
  conditional.
- Running `chowa sync-global` from a consumer repo (chowa installed as a
  dependency, no `.agents/skills/chowa/SKILL.md` present): the
  `existsSync(localSkill)` check already guards the skill-file copy
  (no-ops correctly today and after this fix); only the `AGENTS.md` write
  is unconditional today and needs the corrected, non-blanket wording from
  G3.
- `chowa commit`/`chowa pr` still need *some* remote-update check — G1 only
  removes the global-sync side effect, `gitOps.checkRemoteUpdates` inside
  `handleCheckUpdate` keeps running exactly as before.

## Acceptance Criteria

- [ ] `bun run src/cli.ts commit` and `bun run src/cli.ts pr --base main`,
      run against a repo with a stale/nonexistent `~/.gemini/config/`,
      leave that directory untouched (verified by checking mtime / absence
      before and after).
- [ ] `bun run src/cli.ts check-update` no longer writes to
      `~/.gemini/config/`.
- [ ] `bun run src/cli.ts sync-global` still writes both
      `~/.gemini/config/skills/chowa/SKILL.md` and
      `~/.gemini/config/AGENTS.md`, with content reflecting G2/G3.
- [ ] `.agents/skills/chowa/SKILL.md`, run through the same
      self-repo/consumer/not-installed guard-clause reasoning as the
      Claude Code file, gives correct instructions when read from Chōwa's
      own repo (unchanged effective behavior) — verified by manual read,
      no automated test since this is a doc file.
- [ ] `bun test`, `bun run check:imports`, `bun run build` all remain
      clean.

## Open Questions for Approval

1. OK to fully remove the `handleSyncGlobal()` call from
   `handleCheckUpdate()` (G1), rather than e.g. gating it behind a flag?
   Spec proposes removal since `sync-global` already exists as an explicit
   command and nothing else needs the implicit trigger.
2. OK with `.agents/skills/chowa/SKILL.md` becoming provider-neutral prose
   (currently it's Gemini/self-hosted-flavored) using the same three-mode
   structure as the Claude Code file, rather than staying Gemini-specific?
