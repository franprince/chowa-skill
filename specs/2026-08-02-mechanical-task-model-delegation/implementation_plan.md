# Implementation Plan: Delegate mechanical sub-tasks to a cheaper model

Status: **Done** — 2026-08-02. All four pieces implemented and verified
(`bun test`: 187/187, `bun run check:imports`, `bun run build`,
`bun run scripts/sync-skill.ts --check` all clean).

## Overview

Four independent pieces, ordered so each is checkable on its own:

1. Two new subagent definitions (self-hosted + canonical/plugin-bundled),
   both pinned to the `haiku` alias.
2. A generalization of `scripts/sync-skill.ts`'s single marked-region swap
   into a two-region swap, discovered as necessary while planning this: the
   new delegation instructions reference the `Agent` tool and a named
   subagent, both Claude-Code-specific concepts with no Gemini/Antigravity
   equivalent, so they can't be allowed to leak into the portable copy the
   way everything outside the *existing* invocation marker currently does.
3. `plugins/chowa/skills/chowa/SKILL.md` — new marked section using that
   second region.
4. `.claude/skills/chowa/SKILL.md` — same content, unmarked (this file isn't
   synced anywhere, so no portability concern).
5. Regenerate `.agents/skills/chowa/SKILL.md` and verify it does **not**
   pick up the new section.

No `plugin.json` change: confirmed against current Claude Code plugin docs
that `agents/*.md` at a plugin's root is auto-discovered the same way
`skills/` and `hooks/` already are in this repo (both already work today
with zero `components` field in `plugin.json` or `.claude-plugin/marketplace.json`).
The `components` field exists only to *override* the default directory, not
to opt into discovery.

## 1. New subagent definitions

**Files:**
- `.claude/agents/chowa-mechanical.md` (self-hosted; invoked bare as
  `chowa-mechanical` — project-level agents aren't namespaced)
- `plugins/chowa/agents/chowa-mechanical.md` (canonical; invoked as
  `chowa:chowa-mechanical` once installed via the plugin — plugin-bundled
  agents are namespaced `<plugin-name>:<agent-name>`)

Same content in both:

```markdown
---
name: chowa-mechanical
description: Executes a single, fully-specified mechanical sub-task (a
  rename sweep, a formatting pass, boilerplate scaffolding) handed to it by
  the primary Chōwa pipeline session. Use only when the caller can already
  state the exact correct output or rule to apply — this agent does not
  make design judgment calls.
model: haiku
tools: Read, Edit, Bash
---

Perform exactly the mechanical change described by the caller — nothing
more. If anything about the correct result is ambiguous or requires a
design decision the caller didn't already make, stop and report back what's
unclear rather than deciding yourself.

When finished, report a structured summary of every file changed and what
changed in each — the caller will not re-read the files themselves.
```

`tools` deliberately excludes `Agent` (no nested delegation) and anything
beyond what a mechanical edit needs. **Before writing the final file**,
confirm the exact current frontmatter syntax for `tools` (YAML list vs.
comma-separated string) against a real example already in this Claude Code
version — not asserted here from memory, since getting it wrong silently
breaks the agent definition.

**Verification:** invoke `chowa-mechanical` directly with a trivial rename
task in a scratch file; confirm it runs on Haiku (session/agent metadata
should reflect this) and behaves per its instructions.

## 2. Generalize `scripts/sync-skill.ts` to a two-region swap

**File: `scripts/sync-skill.ts`**

Today `toPortable()` hardcodes one marker pair
(`chowa:invocation:start/end`) and one replacement (`PORTABLE_INVOCATION`).
Generalize to an ordered list of region swaps, applied in sequence:

```ts
interface RegionSwap {
  readonly label: string; // for error messages
  readonly start: string;
  readonly end: string;
  readonly replacement: string; // '' to remove the region entirely
}

const REGION_SWAPS: readonly RegionSwap[] = [
  {
    label: 'invocation',
    start: '<!-- chowa:invocation:start -->',
    end: '<!-- chowa:invocation:end -->',
    replacement: PORTABLE_INVOCATION,
  },
  {
    label: 'delegation',
    start: '<!-- chowa:delegation:start -->',
    end: '<!-- chowa:delegation:end -->',
    replacement: '', // no subagent/Agent-tool equivalent on this harness
  },
];

export function toPortable(canonical: string): string {
  return REGION_SWAPS.reduce((text, swap) => applySwap(text, swap), canonical);
}

function applySwap(text: string, swap: RegionSwap): string {
  const start = text.indexOf(swap.start);
  const end = text.indexOf(swap.end);

  if (start === -1 || end === -1) {
    throw new Error(
      `Canonical skill is missing the ${swap.label} region markers ` +
        `(${swap.start} / ${swap.end}) — cannot generate the portable copy.`,
    );
  }
  if (end < start) {
    throw new Error(`Canonical skill has ${swap.label}'s end marker before its start marker.`);
  }

  return text.slice(0, start) + swap.replacement + text.slice(end + swap.end.length);
}
```

Stripping the delegation region to `''` leaves a blank line or two where the
section was — acceptable (matches how removing the "Known Gap" section from
`.claude/skills/chowa/SKILL.md` earlier this session left clean markdown);
confirm the generated file still renders sensibly and doesn't leave a
dangling `### 8.` heading with no body.

**File: `tests/scripts/syncSkill.test.ts`**

- Existing invocation-region tests continue to pass unmodified (behavior
  unchanged for that region).
- New tests mirroring the same shape for the delegation region: replaces
  the marked region with nothing, throws on missing/inverted markers,
  never leaks `Agent` tool references or the subagent name into the
  portable copy.
- Update (don't remove) `'leaves everything outside the markers
  byte-identical'` and `'the committed portable skill matches what the
  canonical one generates'` — both already read `CANONICAL_SKILL`/
  `PORTABLE_SKILL` from disk and compare against `toPortable()`'s actual
  output, so they keep working against the generalized function without
  rewriting their assertions, as long as `REGION_SWAPS` is applied
  consistently to both.

## 3. Canonical skill: new delegation section

**File: `plugins/chowa/skills/chowa/SKILL.md`**

Insert after `### 7. PR Description Generation`, before `## Chōwa CLI
Reference`:

```markdown
<!-- chowa:delegation:start -->
### 8. Delegating Mechanical Sub-Tasks

Not every step of a live pipeline needs the primary session's model. A
sub-task qualifies for delegation only if, before delegating, you can state
exactly what the correct output looks like (or exactly what mechanical rule
to apply) — renames, formatting passes, boilerplate scaffolding, and the
same shape of work `chowa commit`/`chowa pr` already delegate on your
behalf (a rigid, checkable output generated from an already fully-specified
input). If any part of "what should this become" is still an open design
question, don't delegate — handle it inline.

Skip delegation for trivial one-line edits — the round-trip costs more than
it saves. Delegate only when the mechanical work is large or repetitive
enough (a multi-file rename sweep, a repo-wide formatting pass) that
running it on a cheaper model is worth a subagent call.

To delegate, use the `Agent` tool with `chowa:chowa-mechanical` as the
subagent, and ask it to report back a structured summary of exactly what
changed — not just "done" — so you don't need to re-read every touched
file yourself. If the user has asked you to handle a specific step
directly, that overrides delegation for that step only. If the subagent
hits something needing judgment mid-task, expect it to stop and hand back
rather than deciding on its own.
<!-- chowa:delegation:end -->
```

Note the markers wrap the *entire* section body (not just the invocation
line), same reasoning as the existing invocation region: giving a harness
with no `Agent`-tool equivalent a dangling half-instruction ("here's when
something is mechanical enough to delegate" with no mechanism to delegate
*to*) would be worse than omitting the section outright.

## 4. Self-hosted skill: same section, no markers, bare agent name

**File: `.claude/skills/chowa/SKILL.md`**

Insert after `### 8. Claude Code Bridge`, before `## Chōwa CLI Reference`, as
`### 9. Delegating Mechanical Sub-Tasks` — identical body to §3 above except
the last paragraph reads `chowa-mechanical` (bare, no `chowa:` prefix — this
copy runs as a project-level agent in this repo, not a plugin-bundled one).
No markers needed; this file isn't synced anywhere.

## 5. Regenerate the portable copy

```bash
bun run sync:skill
```

**Verification:** `.agents/skills/chowa/SKILL.md` gains no new section (the
delegation region is stripped), while sections 1–7 and the invocation table
are otherwise unchanged. `bun run sync:skill -- --check` (or equivalent)
passes with no diff after regeneration.

## Test Plan Summary

| Area | New/changed tests |
|---|---|
| `chowa-mechanical` subagent | manual invocation smoke test (see §1) — no automated test target for agent definitions in this repo today |
| `sync-skill.ts` region-swap generalization | extend `tests/scripts/syncSkill.test.ts` with delegation-region cases (removal, missing markers, inverted markers, no leakage) |
| `.agents/skills/chowa/SKILL.md` drift | existing `'the committed portable skill matches what the canonical one generates'` test now also covers the delegation region once regenerated and committed |

No changes anywhere under `src/` — confirmed by the spec's own Non-Goals;
this plan doesn't touch `chowa.config.ts` or `src/router/*`.

## Verification Checklist (Stage 3 exit criteria)

- [x] `bun test` — all pass (187: 184 existing + 3 new sync-skill cases)
- [x] `bun run check:imports` — clean
- [x] `bun run build` — clean
- [x] `bun run sync:skill` regenerates `.agents/skills/chowa/SKILL.md` with
      the delegation section absent and everything else unchanged (also
      verified `--check` reports no drift). Caught and fixed a real bug in
      the first pass: the `### 8.` heading was placed outside the marker
      region, so it leaked into the portable copy with an empty body — the
      marker now wraps the heading too.
- [ ] Manual: invoke `chowa-mechanical` (self-hosted) on a trivial rename in
      a scratch file, confirm correct behavior and Haiku model — **deferred**:
      Claude Code discovers project-level agents at session start, so a file
      created mid-session isn't available to the `Agent` tool until the next
      session. Verified by inspection instead (frontmatter matches the
      confirmed schema exactly). Re-run this check in a fresh session before
      considering the subagent fully proven.
- [x] Manual read-through: both `plugins/chowa/skills/chowa/SKILL.md` and
      `.claude/skills/chowa/SKILL.md` read sensibly with the new section in
      place; `.agents/skills/chowa/SKILL.md` reads sensibly with it absent

## Rollout

Continuing on `feat/mechanical-task-model-delegation` (renamed from the
spec-drafting branch, from `develop`). Suggested commit breakdown:

1. `feat(cli): add chowa-mechanical subagent definitions` — both `.md` files
2. `refactor(cli): generalize sync-skill region swap to support multiple regions` — `scripts/sync-skill.ts` + its tests
3. `docs(chowa): document mechanical sub-task delegation` — both SKILL.md
   edits + regenerated `.agents/skills/chowa/SKILL.md`

Ask before opening a PR (target: `develop`), per the branch-flow rule.
