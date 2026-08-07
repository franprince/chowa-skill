# Spec: Delegate mechanical sub-tasks to a cheaper model during live pipeline execution

Status: **Done** — 2026-08-02. Implemented on branch
`feat/mechanical-task-model-delegation`; see `implementation_plan.md` for
the verification results, including a marker-placement bug caught and
fixed during Stage 3 and one deferred manual check (live subagent
invocation needs a fresh session to pick up a project-level agent created
mid-session).

Resolutions: (1) adopt — the guidance goes into both the canonical skill and
this repo's self-hosted skill, i.e. "for all projects" including Chōwa's own;
(2) canonical **and** self-hosted, see below; (3) reuse Chōwa's existing (thin)
precedent rather than invent new criteria — see "Mechanical criteria" below;
(4) pin the subagent to the semantic alias for whichever provider originated
the request (`haiku` for Claude Code), not a resolved full model ID — see
"Model selection" below.

## Problem Statement

Claude Code Skills support a `model:` frontmatter field that overrides which
model runs the *current turn* of the invoking session (accepts an alias like
`haiku`, a full model ID, or `inherit`; reverts on the session's next prompt).
None of Chōwa's SKILL.md files (`.claude/skills/chowa/SKILL.md`,
`.agents/skills/chowa/SKILL.md`, `plugins/chowa/skills/chowa/SKILL.md`) use
this field, despite the skill's own description advertising "model routing"
as one of its concerns.

Separately, Chōwa already has a real model-routing system —
`chowa.config.ts` + `src/router/` — that routes a `mechanical`-kind
`TaskProfile` to a fast/cheap target (`gemini-3.6-flash`, with a
`claude-haiku` fallback). That system is correctly wired end-to-end as of
`specs/2026-08-01-routing-config-wiring/` (Done): `loadPolicy()` genuinely
loads the config, and the resolved target reaches `ChowaClient.call()`.

The catch: that router only governs LLM calls **Chōwa's own CLI makes
directly** — `generateCommitMessage` and `generatePRDescription`, both of
which call `ChowaClient.call()` out-of-band from any live coding session.
It has no bearing on the model running the **live Claude Code agent** that is
actually following the SKILL.md pipeline and making the code edits (renames,
formatting passes, boilerplate scaffolding, etc.) — that always runs on
whatever model the human picked for the session, for the full multi-turn
duration of the work.

This spec is about whether/how to close that second gap: giving the live
pipeline a way to hand genuinely mechanical, self-contained sub-tasks to a
cheaper model, instead of always executing them inline on the primary
session's model.

## Why the Skill-level `model:` frontmatter doesn't fit this

Confirmed via current Claude Code docs: the override is scoped to a single
turn and reverts automatically on the session's next prompt. Chōwa's
pipeline (spec → plan → execute → commit → PR) spans many turns and mixes
task kinds (mechanical *and* architecture *and* debug) within one
invocation. A single `model:` field on the existing chowa SKILL.md can't
selectively downgrade just the mechanical portions — it would either do
nothing (if set on a skill invoked once at the start) or downgrade the
entire pipeline including the parts that need the strongest reasoning. This
mechanism is a non-goal below, not an oversight.

The lever that *does* fit — already documented and already used elsewhere in
this codebase's own tooling context — is a **subagent** definition
(`.claude/agents/*.md`), which supports a per-agent `model:` frontmatter
field and can be invoked mid-session via the `Agent` tool for a bounded,
self-contained piece of work, then returns control to the primary session
unaffected.

## Mechanical criteria (resolves prior Open Question 3)

Chōwa does already talk about `mechanical` as a task kind, but the existing
definition is thin — it's never been written down as a rule, only implied by
two things: a one-line comment in `chowa.config.ts` ("formatting, renaming,
commit messages") and the two actual production call sites that hardcode
`kind: 'mechanical'` — `generateCommitMessage` (`src/git/commitMessage.ts`)
and `generatePRDescription` (`src/git/prDescription.ts`). Neither is a
criteria list; they're just the two things someone already decided qualify.

Rather than invent a new, stricter definition for this spec alone (which
would leave two different notions of "mechanical" in the codebase), this
spec reuses what those two examples have in common as the delegation bar:

- The output has a **rigid, checkable shape** (a Conventional Commits
  string, a templated PR description) — there's a mechanical way to tell if
  the result is right, no subjective review needed.
- The input is **already fully specified** — a diff cluster, a base branch
  — nothing about the task requires the agent to *decide* what should
  change, only to describe/format a change that's already fully determined.
- **Renames and formatting passes** extend naturally from the same
  principle: the change is fully determined by a mechanical rule (rename A
  to B everywhere; apply this formatter), not a judgment call.

Concretely: a sub-task qualifies for delegation only if the primary agent
can state, before delegating, exactly what the correct output looks like
(or exactly what rule to mechanically apply) — if any part of "what should
this become" is still an open design question, it doesn't qualify and stays
on the primary session's model.

## Model selection (resolves prior Open Question 4)

`ChowaClient.getAvailableModels()` (`src/client.ts:106-117`) — the only
"available models" facility Chōwa has today — is a **hardcoded static
list**, not a live query against any provider or the running environment;
the `claude-code-bridge`'s `models` action just wraps it unchanged. So there
is currently no way to dynamically discover, at runtime, which models a
given provider actually offers. `resolveModelTier()` (`src/router/router.ts`)
can map a semantic tier (`'fast'`, `'balanced'`, ...) against that list, but
the list itself never changes without a code edit — it isn't dynamic in the
way the question implies.

For the specific case this spec needs — the `model:` frontmatter of a
Claude Code subagent definition — there's a simpler answer that sidesteps
Chōwa's own (static) model list entirely: Claude Code's subagent frontmatter
already accepts the semantic alias `haiku` directly (confirmed against
current docs), and that alias is maintained by Claude Code/Anthropic to
always point at the current Haiku model. Pinning the subagent's frontmatter
to the alias — not a resolved full model ID like `claude-haiku-4-5-20251001`
— is "dynamic" in the sense that actually matters here: it stays correct as
the underlying model changes, with no code on Chōwa's side to update.

This does **not** fix Chōwa's own cross-provider `getAvailableModels()`
being static — that's a real, separate gap (relevant to `chowa.config.ts`'s
router, which does need to work across Gemini/Anthropic/OpenAI, where no
shared semantic alias exists). Fixing that is out of scope here; flagged as
a candidate follow-up spec, not bundled into this one.

## Goals

- **G1.** Decide, explicitly, whether the live pipeline should delegate
  genuinely mechanical, self-contained sub-tasks to a cheaper-model subagent
  rather than executing them inline — and document that decision (adopt or
  reject, with rationale) in the SKILL.md files instead of leaving it
  unaddressed.
- **G2.** If adopted: define the delegation mechanism concretely enough to
  follow consistently — a new subagent definition with a pinned cheap model,
  and a workflow-rule subsection stating what qualifies as "mechanical
  enough to delegate."
- **G3.** Keep this scoped to workflow documentation / agent definitions
  only — `chowa.config.ts` and `src/router/*` already correctly solve the
  adjacent (but distinct) problem of routing Chōwa's own outbound CLI calls,
  and are out of scope here.

## Non-Goals

- Not adding a `model:` field to the existing pipeline-spanning chowa
  SKILL.md files — established above as the wrong lever for a multi-turn,
  mixed-task-kind workflow.
- Not building automatic task-kind classification. Any delegation rule
  reuses the same `mechanical | refactor | architecture | security | debug`
  vocabulary the router already uses (`src/router/types.ts`); the primary
  agent still makes the judgment call of which kind a given sub-task is.
- Not modifying `chowa.config.ts`, `src/router/*`, or any adapter/client
  code — this track touches only SKILL.md / agent-definition files.
- Not guaranteeing cost/latency wins are measured — this spec defines the
  mechanism and delegation criteria; benchmarking is separate follow-up work
  if pursued.

## Affected Interfaces

- New: `chowa-mechanical` subagent definition, with `model: haiku` in
  frontmatter (the semantic alias, not a pinned full model ID — see "Model
  selection" above) and a minimal tool list (likely `Read`, `Edit`, `Bash`
  for running verification commands — no `Agent` access, to prevent nested
  delegation). Needed in **two places**, since "adopt for all projects"
  covers both distribution channels and neither is generated from the
  other:
  - `plugins/chowa/skills/chowa/SKILL.md`'s companion agent directory (the
    canonical, user-distributed copy — exact path TBD in the implementation
    plan, likely `plugins/chowa/agents/chowa-mechanical.md` alongside the
    skill it ships with).
  - `.claude/agents/chowa-mechanical.md` — this repo's self-hosted copy,
    hand-maintained like `.claude/skills/chowa/SKILL.md` itself (not
    generated by `sync:skill`).
- `.claude/skills/chowa/SKILL.md` **and** `plugins/chowa/skills/chowa/SKILL.md`
  — both get a new workflow-rule subsection describing when and how to
  delegate, using the criteria from "Mechanical criteria" above. The
  canonical edit propagates to `.agents/skills/chowa/SKILL.md` via
  `bun run sync:skill`; the self-hosted file is edited directly (it isn't
  generated).

## Edge Cases

- A delegated mechanical task turns out to need judgment mid-way (e.g. a
  "pure rename" touches a call site with non-obvious semantics) — the
  subagent should stop and hand back rather than making the call itself.
- The user gives an explicit instruction to handle a specific step directly
  (not delegate) — that overrides the default delegation behavior for that
  step only.
- Trivial one-line mechanical edits shouldn't force an `Agent`-tool
  round-trip — the delegation criteria needs a rough lower bound (e.g. by
  file count or edit scope) so the overhead of spawning a subagent doesn't
  exceed the work being delegated.
- A mechanical task's output needs to feed directly into the next pipeline
  step (e.g. a rename whose result the primary agent immediately builds on)
  — delegation must return a clear, structured summary of what changed, not
  just "done," so the primary session doesn't need to re-read every file to
  find out.

## Acceptance Criteria

- [ ] `chowa-mechanical` subagent definition exists in both
      `.claude/agents/` (self-hosted) and the canonical plugin's agent
      directory, each with `model: haiku` in frontmatter and a tool list
      that excludes `Agent` (no nested delegation).
- [ ] Both `.claude/skills/chowa/SKILL.md` and
      `plugins/chowa/skills/chowa/SKILL.md` document the delegation rule
      using the criteria from "Mechanical criteria" above (rigid/checkable
      output + fully-specified input), consistently worded.
- [ ] `bun run sync:skill` regenerates `.agents/skills/chowa/SKILL.md` from
      the updated canonical file with no manual drift.
- [ ] No changes to `src/router/*`, `chowa.config.ts`, or any `.ts` source
      file under `src/` — this track is documentation/agent-definition only.
- [ ] `bun test`, `bun run check:imports`, `bun run build` remain clean
      (expected to be a no-op check, since no TypeScript changes).

## Resolved Questions

1. **Adopt delegation?** Yes — adopted for all projects, including Chōwa's
   own self-hosted development.
2. **Which skill file(s)?** Both: the canonical
   `plugins/chowa/skills/chowa/SKILL.md` (so every project using the
   distributed skill gets it, propagating to `.agents/skills/chowa/SKILL.md`
   via `sync:skill`) and the self-hosted `.claude/skills/chowa/SKILL.md`
   (edited directly, since it isn't generated).
3. **Delegation bar?** Reuse Chōwa's existing (if thin) precedent rather
   than invent new criteria — see "Mechanical criteria" above: rigid/checkable
   output + fully-specified input, covering renames, formatting, boilerplate,
   and the two production examples (commit-message and PR-description
   generation).
4. **Which model?** The semantic alias for the active provider (`haiku` for
   Claude Code), not a resolved full model ID and not routed through
   Chōwa's own (currently static, non-dynamic) `getAvailableModels()` — see
   "Model selection" above.
