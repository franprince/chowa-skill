---
name: chowa-skill
description: >
  Spec-driven development workflow — spec → plan → execute pipeline, atomic
  Conventional Commits, PR generation, branching rules, and mechanical
  sub-task delegation — using only this harness's own native tools (Read,
  Edit, Write, Bash, Agent) plus `git`/`gh`. No CLI, no bundled engine,
  nothing to install or version separately from the skill itself. Use this
  whenever the user asks to start a new feature, write a spec or
  implementation plan, commit changes, open a pull request, check whether a
  PR is actually ready to merge, or delegate mechanical work to a cheaper
  model — even if they don't name this skill explicitly. Detects whether
  the current project already follows this convention before applying
  anything.
---

# Chōwa Skill (pure-skill variant)

This is a lean sibling of [Chōwa](https://github.com/franprince/chowa), a
CLI-backed coding harness. It carries the same workflow philosophy — spec →
plan → execute, atomic commits, PR generation, branching discipline — but
drives every step through the harness's own native tools instead of a
bundled engine. There is nothing to install, build, or version beyond this
file and the two small pieces that ship alongside it (a subagent for
mechanical delegation, a push-protection hook). If a project wants the
CLI-backed feature set this variant intentionally leaves out — model
routing against live provider data, quota-aware session auto-resume — that
lives in the sibling project instead of here.

## Step 0: Detect whether this project uses this workflow

Check before applying anything below:

1. **Already opted in** — `specs/INDEX.md` exists at the project root (the
   project already follows the spec → plan → execute convention by hand),
   or the user explicitly asks, in this conversation, to use this workflow
   here.
2. **Personal always-on preference** — read `~/.chowa-skill/preferences.json`
   (a plain JSON file, no CLI involved: `{"alwaysOn": true}`). If it doesn't
   exist or can't be read, treat it as off. If enabled, apply this workflow
   to every project regardless of the per-project signal above.
3. **Unrelated project** — none of the above. Say that plainly, **once per
   session, not on every subsequent turn**, then defer to the project's own
   conventions (`CONTRIBUTING.md`, existing commit style in `git log`) for
   the rest of the session. Don't apply the rules below as if they were in
   force. If the user wants this workflow applied to every project they
   personally work in, write `~/.chowa-skill/preferences.json` with
   `{"alwaysOn": true}` for them (creating the directory if needed) rather
   than asking them to run a command that doesn't exist.

## Workflow Rules

### 1. Specification-Driven Pipeline (Spec → Plan → Execute)

For all feature requests and non-trivial changes, follow this 3-stage
lifecycle:

1. **Stage 1: Specification (`spec.md`)** — problem statement, goals,
   non-goals, input/output schemas, edge cases, and acceptance criteria.
   Get explicit user approval before Stage 2.
2. **Stage 2: Implementation Plan (`implementation_plan.md`)** — files to
   modify/create, component boundaries, test plan. Get explicit user
   approval before writing code.
3. **Persistence** — write both files to `specs/<YYYY-MM-DD>-<slug>/`,
   never as loose root-level files, and add a row to `specs/INDEX.md`
   (create that layout if the project doesn't have one yet). Root-level
   `spec.md`/`implementation_plan.md` get overwritten by the next feature's
   docs with no record of what was approved — that's how intent drifts
   across iterations.
4. **Stage 3: Execution & Verification** — implement the approved plan
   (code + tests), then verify with the project's own quality gates
   (see §4). Always ask the user if they want a Pull Request opened after
   committing on a new feature branch.

### 2. Branching & PR Workflow

- Always create a new branch for features/fixes/tasks — never work or push
  directly on `main` or `master`.
- If the project uses a `develop` branch: `fix/*`, `feat/*`, `docs/*`,
  `chore/*` etc. branch from `develop` and PR against `develop`; `release/*`
  and `hotfix/*` branch from `develop` (a `hotfix/*` may branch from `main`
  when patching a live incident) and PR from there to `main`. If the
  project has no `develop` branch, branch from and PR against `main`
  directly. Never push or PR straight to `main`/`master` outside that flow.
- Check the local branch is up to date before starting work or committing:
  `git fetch origin && git status -sb`.
- Always ask the user if they want a PR opened, whenever creating a new
  branch and committing. Open it with `gh pr create`.
- After opening a PR, check whether it's actually mergeable against its
  base (`gh pr view <n> --json mergeable,mergeStateStatus`) — don't treat
  "the PR exists" as "the PR is ready." A base branch that moved since you
  branched can leave it `CONFLICTING` with no error at creation time, and
  CI may not even run until it's resolved. If so, merge the base branch
  into your branch locally, resolve, push, and re-verify before calling
  the PR done.

### 3. Commit Workflow & Messages

Read the diff yourself (`git diff`, `git status`) and split it into
logical clusters by judgment — a heuristic like "group by file" is a
starting point, not a verdict: if two files are one logical change (a
function and its test, a doc and the index row pointing at it), commit
them together. Splitting them would produce a commit that doesn't stand on
its own. Write each commit message directly; there's no separate model
call to delegate this to here. Commits must follow Conventional Commits:
`type(scope): concise imperative description`.

- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`,
  `build`, `style`, `revert`
- Scope: whatever the project uses — check recent `git log`, or an
  existing `commitlint`/similar config.

### 4. Code Quality & Build Verification

Before committing, run the *project's own* test/lint/build scripts (its
`package.json` `scripts`, or whatever the project's own tooling is —
typically something like `test`, `lint`, `build`). This workflow's
conventions don't replace a project's own quality gates.

### 5. Delegation Guidance

There's no live routing policy to resolve here — no config file, no
provider API to query. Use this as a starting heuristic, and defer to
whatever the project's own conventions already say if they conflict:

| Task kind | Suggested approach |
|---|---|
| Mechanical (renames, formatting, boilerplate) — trivial, one-line | Handle inline yourself; the round-trip costs more than it saves. |
| Mechanical — large or repetitive (multi-file sweep, repo-wide pass) | Delegate via the `Agent` tool to a subagent pinned to a fast/cheap model (see §6). |
| Refactor, debug, architecture, security | Primary session model — these need full context and judgment a cheaper model doesn't have. |

### 6. Delegating Mechanical Sub-Tasks

A sub-task qualifies for delegation only if, before delegating, you can
state exactly what the correct output looks like (or exactly what
mechanical rule to apply). If any part of "what should this become" is
still an open design question, don't delegate — handle it inline.

To delegate, invoke the `Agent` tool with the packaged mechanical subagent
as the target. Ask it to report back a structured summary of exactly what
changed — not just "done" — so you don't need to re-read every touched
file yourself. If the user has asked you to handle a specific step
directly, that overrides delegation for that step only. If the subagent
hits something needing judgment mid-task, expect it to stop and hand back
rather than deciding on its own.

### 7. PR Description Generation

Read the commit history and diff against the target base yourself
(`git log <base>..HEAD`, `git diff <base>...HEAD`), then write the PR
description directly — summary, changes, testing notes, and (for a
release/hotfix) a rollout/rollback plan. Open or update it with `gh pr
create` / `gh pr edit`.

## What this skill intentionally does not do

- **No model routing against live provider data.** The table in §5 is a
  fixed heuristic, not a resolved policy — there's no `chowa.config.ts`
  and no router here.
- **No session-lifecycle tracking or quota-aware auto-resume.** That needs
  real hook scripts reacting to `SessionStart`/`StopFailure` events, which
  fire outside any model turn — genuinely not something a tool-calls-only
  skill can do. If you need that, it lives in the CLI-backed sibling
  project, not here.
- **No commit-message generation via a separate delegated model call.**
  The primary session model writes commit messages and PR descriptions
  directly (§3, §7) — simpler than routing that through another call, at
  the cost of not being able to pin a cheaper model specifically for it.

## Quick Reference

| What | How |
|---|---|
| Check remote is up to date | `git fetch origin && git status -sb` |
| Inspect the diff before committing | `git diff`, `git status` |
| Open a PR | `gh pr create` |
| Check a PR is actually mergeable | `gh pr view <n> --json mergeable,mergeStateStatus` |
| PR description context | `git log <base>..HEAD`, `git diff <base>...HEAD` |
| Personal always-on preference | `~/.chowa-skill/preferences.json` — `{"alwaysOn": true}` |
