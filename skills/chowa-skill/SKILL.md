---
name: chowa-skill
description: >
  Spec-driven development with durable plans, atomic Conventional Commits,
  PR preparation and readiness checks, and bounded mechanical delegation.
  Use for new features, specs, implementation plans, implementing approved
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
| Feature or non-trivial change | Spec → plan/tasks → execute, starting at the first unfinished stage |
| Spec or plan only | Produce the requested artifacts and stop at that boundary |
| Commit existing changes | Review the diff, verify, and create logical commits |
| Open/update a PR or assess readiness | Review branch/diff/checks and follow the PR workflow |
| Read-only review or trivial edit | Handle directly; a trivial edit needs no new spec/plan/tasks |
| Roadmap | Use the requested roadmap procedure |

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

Resolve references and bundled `scripts/` relative to the directory containing
this SKILL.md. Use verified absolute script paths with the target project as
CWD. The complete skill directory includes its helpers and hook definitions;
helpers require Node.js 22 or newer on PATH.

## Workflow Rules

### 1. Specification-Driven Pipeline

Use these stages for features and non-trivial changes, within the requested
scope. Existing authorization covers the same stage and scope on resumption.

1. **Project principles:** read `specs/CONSTITUTION.md` if present. Before a
   project's first spec, offer to draft it without blocking the task. Flag
   conflicts with its principles; agree on material changes with the user.
2. **Backlog:** for work spanning dependent phases or multiple PRs, record
   milestones and execution order in `specs/BACKLOG.md`.
3. **Spec:** write the problem, goals, non-goals, relevant inputs/outputs,
   edge cases, and acceptance criteria. Resolve ambiguities that affect
   scope or acceptance; state reasonable implementation assumptions. Obtain
   approval before planning unless that scope is already authorized.
4. **Plan and tasks:** describe files, components, and verification in
   `implementation_plan.md`; create `tasks.md` with concrete checkable items
   and their dependencies. Review both together before coding, using existing
   authorization where applicable.
5. **Coverage:** for complex changes, map acceptance criteria to plan/tasks
   before execution. Correct routine omissions within scope; raise unresolved
   requirements or scope changes with the user.
6. **Execute and verify:** implement the plan, check off tasks as completed,
   and run applicable project quality gates. Mirror tasks into host tracking
   only when useful. Resume from the durable checklist after interruption.

Persist `spec.md`, `implementation_plan.md`, and `tasks.md` under
`specs/<YYYY-MM-DD>-<slug>/`. Create or update `specs/INDEX.md` with a
`Date | Slug | Status | Summary` row. Maintain the project's status vocabulary;
if none exists, use `Draft`, `Approved`, `In Progress`, `Done`, `Dismissed`,
or `Superseded by <link>`. Keep the index and feature status consistent.

### 2. Branching and PR Workflow

- Use a topic branch for changes. Reuse the branch for the current task;
  create one for a new task. Preserve unrelated working-tree changes.
- Follow repository branch conventions. By default, branch from and target
  `develop` when it exists. Release/hotfix branches target the default branch;
  hotfixes may start there for a live incident. Otherwise, topic branches
  start from and target the repository's default branch (`main` or `master`).
- Before starting branch work, fetch the relevant remote and inspect branch
  status. Recheck before publishing; reconcile divergence before claiming
  readiness. Report unavailable remote checks without inventing freshness.
- When PR preparation is within scope, create or update it if requested or
  already authorized. Otherwise, prepare its title/body and ask once before
  publishing it. Authorization to create a PR does not itself authorize
  merging it.
- Use `gh pr create` / `gh pr edit`. Check mergeability with
  `gh pr view <n> --json mergeable,mergeStateStatus` and required checks with
  `gh pr checks <n>`. Resolve base conflicts on the topic branch, verify,
  and push within the authorized scope. Pending, unknown, or failing checks
  must be reported accurately; they do not establish readiness.

### 3. Commits and Verification

Inspect `git status`, the working diff, and the staged diff. Group commits
by logical change, keeping implementation/tests and linked documentation
together. Write commit messages directly in the primary session.

Use Conventional Commits: `type(scope): imperative description`, following
repository types and scope conventions. Run the project's required
checks appropriate to the change before committing. Reuse passing results
while the relevant code and environment are unchanged; rerun affected checks
after fixes. Report skipped checks and unresolved failures.

### 4. Hook Guards

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

### 5. Mechanical Delegation

Delegate a mechanical task only when its exact output or transformation rule
is known and its size/repetition justifies the extra call. Handle trivial
edits inline. Keep unresolved design decisions in the primary session; follow
repository guidance on model choice and the user's requests for direct work.

The optional Claude Code plugin supplies `chowa-skill-mechanical`. For a
standalone skill or another host, use native delegation with a permitted model
when available; otherwise execute inline. Never assume a named agent or model
exists across hosts.

Send the rule, owned files, relevant excerpts, constraints, and verification
criteria. Avoid forwarding unrelated history; batch changes governed by the
same rule. Require a concise report of changed files, applied changes, checks,
and unresolved issues. The subagent stops if a new design decision is needed.
The primary agent remains responsible for reviewing the diff and verifying
the result; use the report to target further inspection.

### 6. PR Descriptions

Read `git log <base>..HEAD` and `git diff <base>...HEAD`, then write the PR
description directly.

Describe the resulting behavior, material changes, and verification. Include
a rollout/rollback plan for releases or hotfixes where relevant. End the PR
description with this footer, replacing any default assistant attribution:

```text
調和 (Chōwa) — spec → plan → execute, verified before merge
```

Experimental visual proof is enabled only by an explicit user request or a
standing project instruction. UI file extensions alone do not enable it.

When enabled, read [Visual proof](references/visual-proof.md). Run the
Storybook collector only when specifically requested for a Storybook UI.

### 7. Optional Procedures

Read only the reference needed for the current request:

- Requested roadmap or development history: [Roadmap](references/roadmap.md).
- `ste100` enabled: [Simplified English](references/simplified-english.md).
  An explicit project setting overrides the personal preference; default off.
  Read the setting from `chowa.config.js` or personal preferences as data.
