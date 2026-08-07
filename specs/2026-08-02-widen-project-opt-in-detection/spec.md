# Spec: Widen project opt-in detection + onboarding for un-opted-in projects

Status: **Done** — 2026-08-02. Implemented on branch
`feat/widen-project-opt-in-detection` (off `develop`). All open questions
resolved as proposed: (1) signal (b) requires `specs/INDEX.md` specifically;
(2) command is `chowa init`; (3) scaffold is always `.js`; (4) always-on is
a Chōwa-level preference file + CLI command, not harness-specific prose;
(5) preference file lives at `~/.chowa/preferences.json`.

## Problem Statement

Step 0 of the canonical skill (`plugins/chowa/skills/chowa/SKILL.md`, mirrored
in `.agents/skills/chowa/SKILL.md` and summarized in
`globalRulesContent()` in `src/integrations/install.ts`) currently recognizes
exactly one signal that a project has opted into Chōwa's workflow (Mode 2): a
literal `chowa.config.ts`/`.js`/`.mjs` file at the project root. Anything else
falls into Mode 3, which is a hard stop — "say that plainly and stop... only
raise adopting Chōwa if the user asks."

Feedback from a real session (2026-08-02, an unrelated app run against a
project with no `chowa.config.*`) showed the practical cost of that single
literal check: the skill correctly avoided imposing Chōwa's branching/commit
conventions, but it also gave the user no path forward — no acknowledgment
that other signals might indicate they *do* want Chōwa, and no next step
besides "add a file by hand." That's two separate gaps:

1. **Detection is too narrow.** A project can already be following Chōwa's
   conventions in spirit — a `specs/` directory shaped like Chōwa's own
   dated-slug pipeline, `chowa` installed as an actual project dependency —
   without ever having written a config file.
2. **Mode 3 is a dead end.** A user who doesn't already know the exact
   filename `chowa.config.js` gets no guidance toward it unless they happen
   to ask the right question.
3. **No per-user override exists.** Every signal considered so far, old and
   new, is per-project. A user who has decided they want Chōwa's workflow
   for everything they personally do has no way to say so once — they'd
   need to either opt in to every project one at a time, or (as raised and
   rejected during spec review) rely on `chowa` being globally installed,
   which can't work as a signal because it's true for every project on the
   machine simultaneously and carries no per-repo intent.

## Goals

- **G1.** Recognize three additional opt-in signals at Step 0, any one of
  which promotes a project straight to Mode 2 (same as finding a config
  file):
  - **(a) Dependency install** — `chowa` listed in `dependencies` or
    `devDependencies` of `package.json`. This is a deliberate, project-level
    action distinct from the global plugin being installed in the harness.
  - **(b) Existing spec convention** — `specs/INDEX.md` exists at the
    project root. This is the one artifact most distinctively shaped like
    Chōwa's own pipeline (see this repo's `specs/INDEX.md`), cheap to check,
    and low false-positive risk compared to matching on a bare `specs/`
    directory name (which collides with e.g. API-spec or test-spec folders
    in unrelated projects).
  - **(c) Explicit in-session request** — the user directly asks to use
    Chōwa's conventions/workflow for this project. Session-scoped: apply
    Mode 2 behavior for the rest of the conversation, and mention once that
    running `chowa init` (G3) would make the choice stick across sessions,
    without insisting on it.
- **G2.** Replace Mode 3's flat stop with a one-time onboarding offer: state
  plainly that the project isn't set up for Chōwa, then offer — once, not on
  every subsequent turn — either of two paths: scaffold a per-project
  `chowa.config.js` now (G3), or turn on the personal always-on preference
  (G5) so this and every future project apply Mode 2 by default. If the
  user declines or ignores both, proceed exactly as Mode 3 does today (defer
  to the project's own conventions, don't ask again this session).
- **G3.** Add a real `chowa init` CLI command backing the per-project path:
  writes a minimal, working `chowa.config.js` (starter content derived from
  `DEFAULT_POLICY` in `src/router/loadPolicy.ts`) to the project root.
  Refuses (non-zero exit, no write) if any of `CONFIG_CANDIDATES` already
  exists, naming the file it found.
- **G4.** Keep `globalRulesContent()`, the canonical skill, and the
  regenerated portable skill (`bun run sync:skill`) consistent with the
  widened rules.
- **G5.** Add a personal, per-user always-on preference: a new
  `chowa always-on [on|off]` CLI command that reads/writes a small
  preference file at `~/.chowa/preferences.json`, independent of any
  project and of harness (Claude Code, Gemini, Antigravity all check the
  same file). When enabled, Step 0 treats **every** project as Mode 2,
  regardless of the per-project signals in G1 — falling back to
  `DEFAULT_POLICY` in projects with no `chowa.config.*` of their own, which
  `loadPolicy.ts` already does. This is the answer to "I want Chōwa to be
  the workflow for everything I do": a single, explicit, user-scoped
  action — not an inference from `chowa` merely being available on the
  machine (see Problem Statement, point 3).

## Non-Goals

- Not changing Mode 1 (self-repo) detection.
- Not making Mode 3 apply workflow rules *before* onboarding is accepted —
  declining or ignoring the offer still means "defer to project
  conventions," same as today.
- Not building an interactive CLI prompt/wizard (no `readline` questions
  inside `chowa init` itself). The "guided" part of onboarding is the
  agent/skill conversation; `chowa init` itself is a plain, non-interactive
  scaffold call, easy to test.
- Not auto-detecting project language/framework to tailor the generated
  config — the scaffold is the same minimal starter every time; users edit
  routing rules by hand afterward, same as they would after copying the
  example in `chowa.config.ts`.
- Not touching `src/integrations/antigravity/skill.md` (no Step 0 / mode
  concept exists there today) or the project-local
  `.claude/skills/chowa/SKILL.md` (always self-repo mode, out of scope per
  the prior `portable-global-skill-sync` spec).
- Not solving false positives for signal (b) beyond requiring
  `specs/INDEX.md` specifically (see Edge Cases).
- Not making always-on override a project's own quality gates (Workflow
  Rule §5 — "run the project's own test/lint/build scripts") or otherwise
  change what Mode 2 *does*; it only changes whether Mode 2 applies,
  everywhere, for this user.
- Not adding per-project exceptions to always-on (e.g. an allow/deny list of
  repos) — it is a single global on/off switch. A user who wants an
  exception for one specific repo can just say so in conversation for that
  session; a persisted allow/deny list is future work if that proves not to
  be enough.

## Affected Interfaces

- `src/router/loadPolicy.ts` — no change to `DEFAULT_POLICY` itself; it
  becomes the source for the scaffold's starter content.
- **New:** `src/integrations/initConfig.ts` — pure, testable functions:
  `defaultConfigFileContents(): string` (renders `DEFAULT_POLICY` as a
  `chowa.config.js` module) and `planInit(cwd, exists)` (decides the target
  path / existing-file conflict, mirroring the `planInstall` /
  filesystem-write split already used in `src/integrations/install.ts`).
- `src/cli.ts` — add `case 'init':` → thin `handleInit()` wrapper that calls
  `planInit`, writes the file, and prints next steps; add
  `case 'always-on':` → thin `handleAlwaysOn(arg)` wrapper around the new
  preferences module.
- **New:** `src/integrations/preferences.ts` — pure, testable functions:
  `PREFERENCES_PATH` (default `~/.chowa/preferences.json`),
  `readPreferences(path?): { alwaysOn: boolean }` (missing file → default
  `{ alwaysOn: false }`; a present-but-unparseable file throws, same
  fail-loudly-on-edited-state philosophy as `loadPolicy.ts`), and
  `writePreferences(prefs, path?)`.
- `src/integrations/install.ts` — update `globalRulesContent()`'s bullet
  list to describe the widened signal set (G1) and mention the always-on
  preference (G5) instead of only the literal config file.
- `plugins/chowa/skills/chowa/SKILL.md` — rewrite Step 0: add signals (a)–(c)
  to Mode 2, add the always-on preference check ahead of the per-project
  signals, replace Mode 3's flat stop with the one-time onboarding offer
  pointing at both `chowa init` and `chowa always-on on`.
- `.agents/skills/chowa/SKILL.md` — regenerated from the canonical file via
  `bun run scripts/sync-skill.ts`; not hand-edited.
- `README.md` — update the "Then opt a project in by adding a
  `chowa.config.ts`..." paragraph in the Install section to mention the
  additional signals, `chowa init`, and `chowa always-on`.
- **Tests:** new `tests/integrations/initConfig.test.ts` and
  `tests/integrations/preferences.test.ts`; update
  `tests/integrations/install.test.ts` for the `globalRulesContent()` wording
  change.

## Edge Cases

- `specs/` directory exists but isn't Chōwa-shaped (e.g. OpenAPI specs, RSpec
  `spec/`, test fixtures) — requiring `specs/INDEX.md` specifically (not just
  a `specs/` directory) is the mitigation; a project would need to have
  independently built the same index-file convention to false-positive.
- `chowa` appears in `package.json` for an unrelated reason — accepted risk;
  the package name is specific enough (`chowa`, not a generic word) that a
  collision is unlikely.
- User accepts onboarding mid-conversation for an unrelated original
  request — `chowa init` runs, Mode 2 applies from that point forward in the
  session, but the original request the user actually asked for still gets
  answered; onboarding is additive, not a detour that blocks it.
- `chowa init` invoked in Mode 1 (self-repo, already has a committed
  `chowa.config.ts`) — hits the same "already exists" refusal as any other
  project; no self-repo special case needed.
- Project has no `package.json` (non-JS project) — signal (a) simply never
  matches; signals (b)/(c) and the original literal-config-file check are
  language-agnostic and still work.
- Onboarding offer must not repeat every turn — mention it once per Mode-3
  session, not on each subsequent message, to avoid recreating the exact
  "recites Chōwa at a project that doesn't want it" complaint the mode-3
  stop was originally built to fix.
- `~/.chowa/preferences.json` doesn't exist yet (fresh install, never run
  `chowa always-on`) — treated as `{ alwaysOn: false }`, identical to
  today's behavior; no onboarding-offer regression for users who never
  touch the feature.
- `~/.chowa/preferences.json` exists but is corrupted/hand-edited into
  invalid JSON — `readPreferences` throws rather than silently defaulting
  to off, so a broken file surfaces immediately instead of quietly
  disabling something the user turned on.
- Always-on is enabled and the user works in a shared/team repo with its
  own established conventions that conflict with Chōwa's defaults (e.g. no
  `develop` branch, different commit style) — Mode 2's existing branching
  rule already handles the no-`develop`-branch case (falls back to
  branching from/PRing against `main`), and workflow rule §5 already says
  to run the *project's* own quality gates, not Chōwa's. Always-on doesn't
  need new logic here; it inherits whatever accommodations Mode 2 already
  makes.
- `chowa always-on` run with self-repo (Mode 1) active — no interaction;
  Mode 1 is checked first and is unaffected by the preference either way.

## Acceptance Criteria

- [ ] `chowa init` in a directory with none of `CONFIG_CANDIDATES` writes
      `chowa.config.js`; a subsequent `chowa route --kind mechanical
      --complexity low` run in that directory reflects the written policy
      (proves the scaffold round-trips through the real loader, not just
      that a file was written).
- [ ] `chowa init` in a directory that already has any `CONFIG_CANDIDATES`
      file exits non-zero, names the existing file in its message, and does
      not modify it.
- [ ] `globalRulesContent()` describes the widened signal set; existing
      `tests/integrations/install.test.ts` assertions updated to match.
- [ ] `plugins/chowa/skills/chowa/SKILL.md` Step 0 documents signals (a)–(c),
      the always-on preference, and the one-time onboarding offer covering
      both paths; `bun run scripts/sync-skill.ts --check` passes against the
      regenerated portable copy.
- [ ] `chowa always-on on` writes `~/.chowa/preferences.json` with
      `alwaysOn: true`; `chowa always-on off` sets it back to `false`;
      `chowa always-on` with no argument prints the current state without
      changing it.
- [ ] `readPreferences()` against a missing file returns `{ alwaysOn: false
      }`; against a corrupted file, throws rather than defaulting silently.
- [ ] `bun test`, `bun run check:imports`, `bun run build` all clean.

## Open Questions for Approval

1. Signal (b): require `specs/INDEX.md` specifically (cheap, low
   false-positive, matches this repo's own convention exactly), rather than
   pattern-matching any `specs/<date>-<slug>/spec.md` directory without an
   index? Spec proposes requiring the index file.
2. Command name: `chowa init` (matches `git init`/`npm init` convention) vs.
   `chowa onboard`? Spec proposes `init`.
3. Scaffold format: `chowa init` always writes `chowa.config.js` (not
   `.ts`), matching `loadPolicy.ts`'s own reasoning that `.js` needs no
   type-stripping and works on every runtime Chōwa targets. TypeScript users
   can rename/convert by hand. OK with `.js` as the fixed default?
4. **Resolved during spec review:** the always-on mechanism (G5) is a
   Chōwa-level preference file + CLI command, not a line added to each
   harness's own global instructions file — chosen specifically so it's
   enforced by the CLI itself (testable, visible to non-interactive callers
   like the Claude Code bridge) rather than living only in prose that can
   drift from Step 0's actual wording.
5. Preference file location: `~/.chowa/preferences.json`, following this
   codebase's existing per-tool-dotfile convention (`~/.gemini/config/`,
   `~/.claude/`) rather than introducing an XDG `~/.config/chowa/` path with
   no precedent elsewhere in the repo. OK with `~/.chowa/`?
