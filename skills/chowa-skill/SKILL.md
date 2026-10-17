---
name: chowa-skill
description: >
  Spec-driven workflow for projects that opt into Chōwa (specs/INDEX.md or
  chowa.config.* at the root, or the user's always-on preference) or when the
  user asks for it: specs and spec roasts, plans, implementing approved work,
  Conventional Commits, PRs, mechanical delegation, and roadmap views. Without
  opt-in, follow repository conventions instead.
---

# Chōwa Skill

Use the host's native tools and `git`/`gh` for spec → plan → execute work.

## Activation

On first use in a session, check the project root and read
`~/.chowa-skill/preferences.json`; missing or unreadable preferences mean
defaults. Reuse this context until the project or preferences change. When
asked to enable always-on behavior, set only `"alwaysOn": true` in that file,
preserving other keys.

The workflow applies when:

- `specs/INDEX.md` or `chowa.config.js`, `chowa.config.ts`, or
  `chowa.config.mjs` exists at the project root, or preferences set
  `"alwaysOn": true` (persistent opt-in); or
- the user explicitly requests this workflow in the conversation. Hooks
  recognize this only once `specs/INDEX.md` exists; until then, keep spec
  files in the agreed paths yourself.

Otherwise, follow the repository's conventions for every request, including
commits and PRs. Do not start the pipeline, create opt-in markers, or apply
Chōwa defaults such as its PR footer. Explain activation only when relevant.

If the CLI-backed Chōwa plugin's `chowa` skill is also loaded, let one
workflow lead. Defer to `chowa` when the `chowa` command is on PATH or the
project lists `chowa` as a dependency; otherwise this skill leads. Never
combine both rule sets or run both pipelines; say once which one leads.

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
record that authorization and proceed; this also covers resumption. Ask only
for an outstanding decision or approval, after preparing the concrete
artifacts. Material scope changes require renewed agreement. Approval to
create a PR or to run an interview never implies approval to merge or build.

## Host capabilities

Procedures name capabilities, not tools: `ask_user`, `track_tasks`,
`delegate`, `run_shell`, and `edit_files`. Use this host's equivalent or the
fallback in [Host capabilities](references/host-capabilities.md); a missing
tool never blocks the workflow.

Resolve Markdown links relative to the file containing them and bundled
`scripts/` relative to this SKILL.md's directory. Run helpers by verified
absolute path with the target project as CWD; they need Node.js 22+ on PATH.
Run them without reading their source unless you are debugging a helper.

## Routing and shared constraints

Read only the procedure needed for the current stage; follow its links when a
transition requires another. Do not preload them all. Honor the requested
boundary: spec-only and plan-only work stops there.

For implementation, use a topic branch, preserve unrelated changes, and follow
[Delivery](references/delivery.md) for branch conventions. Run the project's
applicable quality gates before claiming completion.

Do not add code comments unless requested, required by repository conventions
or tooling, or needed to explain a non-obvious correctness constraint. Leave
no change narration or commented-out code; keep useful existing comments.
Pass this rule on in delegated task constraints.

### Hook guards

Keep `spec.md`, `implementation_plan.md`, and `tasks.md` in the feature's
dated directory; guards in opted-in projects reject them at the root. When a
guard asks or denies, follow the host's permission decision. For guard
behavior, installation, or troubleshooting, read [Hook setup](references/hooks.md).

### Optional procedures

- Visual proof, only on an explicit request or a standing project instruction
  (UI file types alone do not count): read [Visual proof](references/visual-proof.md).
- Requested roadmap or development history: read [Roadmap](references/roadmap.md).
- `ste100` enabled (a project `chowa.config.js` boolean overrides the personal
  preference; default off; read both as data): read
  [Simplified English](references/simplified-english.md).
