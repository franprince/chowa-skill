---
name: chowa-skill
description: >
  Spec-driven development with durable plans, atomic Conventional Commits,
  optional spec roasts, PR readiness checks, and bounded mechanical delegation.
  Use for new features, specs or spec refinement, plans, implementing approved
  work, commits, PRs, mechanical delegation, or requested roadmap views.
  Check project or user opt-in before applying the workflow; otherwise
  follow repository conventions.
---

# Chōwa Skill

Use the host's native tools and `git`/`gh` for spec → plan → execute work.
The workflow runs in Claude Code, Codex, and Gemini CLI.

## Activation

On first use in a session, check the project root and read
`~/.chowa-skill/preferences.json`. Reuse this context until the project or
preferences change. Missing or unreadable preferences mean defaults.

- Persistent opt-in: `specs/INDEX.md` or `chowa.config.js`,
  `chowa.config.ts`, or `chowa.config.mjs` exists at the project root;
  alternatively, personal preferences set `"alwaysOn": true`.
- Conversation opt-in: the user explicitly requests this workflow here.
  Hooks cannot read that request; they recognize it once the pipeline
  creates `specs/INDEX.md`. Until then, enforce the agreed paths yourself.
- Otherwise, follow the repository's conventions. Explain activation only
  when relevant to the request; do not start this pipeline or create markers.

When asked to enable always-on behavior, update only `alwaysOn` in the
personal JSON file, preserving other keys. This preference applies when the
skill is loaded; it does not install a session-start hook.

## Task entry and authorization

Follow the user's requested scope and repository instructions. Resume an
existing feature from its current artifacts; avoid restarting approved stages.

| Request | Entry point |
|---|---|
| Feature, spec, plan, or implementation | Read [Pipeline](references/pipeline.md); start at the first unfinished authorized stage |
| Explicit spec roast or requirements stress-test | Read [Spec refinement](references/spec-refinement.md); refine the spec before planning |
| Commit changes or open/update/review a PR | Read [Delivery](references/delivery.md); inspect existing work without starting a spec pipeline |
| Requested mechanical delegation | Read [Delegation](references/delegation.md); check whether the work qualifies |
| Read-only review or trivial edit | Handle directly; a trivial edit needs no new spec/plan/tasks |
| Roadmap | Read [Roadmap](references/roadmap.md) |

Spec and plan approval are checkpoints, not repeated questions. If the user
already authorized the same scope, including a request to plan and implement,
record that authorization and proceed. Ask only for an outstanding decision
or approval; prepare the concrete artifacts before asking. Material scope
changes require renewed agreement.

## Host capabilities

Use the available file, shell, question, and subagent tools. Claude tool names
such as `AskUserQuestion`, `TaskCreate`, and `Agent` are examples, not required
APIs. If a question tool is unavailable, ask in conversation. If task tracking
is unavailable or redundant, use `tasks.md`; if delegation is unavailable,
execute the task inline.

Resolve each Markdown link relative to the file containing that link. Resolve
bundled `scripts/` relative to the directory containing this SKILL.md. Use
verified absolute script paths with the target project as CWD. The complete skill directory includes its helpers and hook definitions;
helpers require Node.js 22 or newer on PATH.

## Routing and shared constraints

Read only the procedure needed for the current stage. Follow its links when a
transition or optional choice requires another procedure; do not preload them
all. References are local instructions for this agent, not separate agent calls
or dependencies on installed skills. Already-read instructions may remain in
the host's conversation context; modularity defers loading but does not guarantee
that earlier instructions are unloaded.

Honor the requested boundary: spec-only and plan-only work stops there. Use the
existing feature directory and durable checklist on resumption. The pipeline
owns the optional refinement offer before first-time planning; accepting it
loads the refinement procedure, and declining it preserves normal clarification.

For implementation, use a topic branch, preserve unrelated changes, and follow
[Delivery](references/delivery.md) for repository branch conventions. Run the
project's applicable quality gates before claiming completion. Read
[Delegation](references/delegation.md) only when considering that capability.

### 1. Hook guards

Installed guards request approval for recognized protected-branch pushes,
deletes, and merges, or deny where the host cannot ask. Push/merge protection
applies in every project. Spec-location protection applies to persistent
opt-in signals: the index, a `chowa.config.js`/`.ts`/`.mjs` file, or personal
`alwaysOn`. It rejects root-level `spec.md`, `implementation_plan.md`, and
`tasks.md`; move these into the feature's dated directory.

Honor existing user authorization, but follow the host's permission decision
when a guard intervenes. Guards do not infer conversational approval.
Protection depends on installed adapters and recognized input shapes;
malformed or unsupported payloads can defer to normal host permissions.

For hook installation or troubleshooting, read [Hook setup](references/hooks.md).

### 2. Optional procedures

- Explicit visual-proof request or a standing project instruction: read
  [Visual proof](references/visual-proof.md). File extensions alone do not
  enable it; the Storybook collector needs its own explicit request.
- Requested roadmap or development history: read [Roadmap](references/roadmap.md).
- `ste100` enabled: read [Simplified English](references/simplified-english.md).
  An explicit project setting overrides the personal preference; default off.
  Read the setting from `chowa.config.js` or personal preferences as data.
