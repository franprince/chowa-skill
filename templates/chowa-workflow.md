<!--
  Source of truth for the shared parts of the Chōwa workflow, consumed by
  two generators:

    - chowa-skill's own `scripts/generate-skill.mjs` (this repo), which
      keeps `shared` + `chowa-skill-only` blocks and appends the two
      sections that live only in the generated file (see that script).
    - chowa's `scripts/sync-skill.ts` (github.com/franprince/chowa), which
      fetches this file at a pinned commit SHA, keeps `shared` +
      `chowa-only` blocks, and splices the result into its own skeleton
      (frontmatter, Step 0, and the fully chowa-only sections — Model
      Routing, Remote Update Checks, Quota-Aware Session Auto-Resume,
      Subagent-Driven Development, CLI Reference — are chowa-local and
      never extracted from here).

  Every block below is wrapped in exactly one start/end marker pair, tagged
  `shared`, `chowa-only`, or `chowa-skill-only`. Headings inside shared/
  mixed sections carry no section number — each generator numbers `### `
  headings sequentially when it assembles its own Workflow Rules list,
  since the two outputs don't share a numbering scheme.

  Changing this file changes both chowa-skill's next generated SKILL.md
  and, once chowa's pin is bumped, chowa's canonical + portable skills
  too. Treat it accordingly.
-->

<!-- variant:chowa-skill-only -->
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
   on turn 1 of every session (a plain JSON file: `{"alwaysOn": true}`). If it
   doesn't exist or can't be read, treat it as off. If enabled, apply this
   workflow automatically on turn 1 to every project regardless of per-project signals.
3. **Unrelated project** — none of the above. Say that plainly, **once per
   session, not on every subsequent turn**, then defer to the project's own
   conventions (`CONTRIBUTING.md`, existing commit style in `git log`) for
   the rest of the session. Don't apply the rules below as if they were in
   force. If the user wants this workflow applied to every project they
   personally work in, write `~/.chowa-skill/preferences.json` with
   `{"alwaysOn": true}` for them (creating the directory if needed) rather
   than asking them to run a command that doesn't exist.
<!-- variant:end -->

<!-- variant:shared -->
## Workflow Rules
<!-- variant:end -->

<!-- variant:shared -->
### Specification-Driven Pipeline (Spec → Plan → Execute)

For all feature requests and non-trivial changes, follow this lifecycle:

1. **Stage 0: Backlog Breakdown (`specs/BACKLOG.md`)** — for complex tasks
   spanning multiple modules, dependent phases, or multiple PRs, create
   `specs/BACKLOG.md` first to outline epic milestones, sub-tasks, and
   execution order before breaking individual tasks into specs.
2. **Stage 1: Specification (`spec.md`)** — problem statement, goals,
   non-goals, input/output schemas, edge cases, and acceptance criteria.
   Get explicit user approval before Stage 2.
3. **Stage 2: Implementation Plan (`implementation_plan.md`)** — files to
   modify/create, component boundaries, test plan. Get explicit user
   approval before writing code.
4. **Persistence** — write both files to `specs/<YYYY-MM-DD>-<slug>/`,
   never as loose root-level files, and add a row to `specs/INDEX.md`
   (create that layout if the project doesn't have one yet). Root-level
   `spec.md`/`implementation_plan.md` get overwritten by the next feature's
   docs with no record of what was approved — that's how intent drifts
   across iterations.
5. **Stage 3: Execution & Verification** — implement the approved plan
   (code + tests), then verify with the project's own quality gates (see
   the Code Quality & Build Verification section below). Always ask the
   user if they want a Pull Request opened after committing on a new
   feature branch.
<!-- variant:end -->

<!-- variant:shared -->
### Branching & PR Workflow

- Always create a new branch for features/fixes/tasks — never work or push
  directly on `main` or `master`.
- If the project uses a `develop` branch: `fix/*`, `feat/*`, `docs/*`,
  `chore/*` etc. branch from `develop` and PR against `develop`; `release/*`
  and `hotfix/*` branch from `develop` (a `hotfix/*` may branch from `main`
  when patching a live incident) and PR from there to `main`. If the
  project has no `develop` branch, branch from and PR against `main`
  directly. Never push or PR straight to `main`/`master` outside that flow.
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
- Check the local branch is up to date before starting work or committing:
  `git fetch origin && git status -sb`.
<!-- variant:end -->
<!-- variant:shared -->
- Always ask the user if they want a PR opened, whenever creating a new
  branch and committing.
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
- Open the PR with `gh pr create`.
<!-- variant:end -->
<!-- variant:shared -->
- After opening a PR, check whether it's actually mergeable against its
  base (`gh pr view <n> --json mergeable,mergeStateStatus`) — don't treat
  "the PR exists" as "the PR is ready." A base branch that moved since you
  branched (especially `develop` → `main` on a `release/*`/`hotfix/*` PR)
  can leave it `CONFLICTING` with no error at creation time, and CI may
  not even run until it's resolved. If so, merge the base branch into your
  branch locally, resolve, push, and re-verify before calling the PR done.
<!-- variant:end -->

<!-- variant:shared -->
### Commit Workflow & Messages
<!-- variant:end -->

<!-- variant:chowa-only -->
```bash
chowa commit
```

Chōwa clusters the diff by file, which is a heuristic, not a verdict: if
two reported clusters are one logical change (a doc and the index row
pointing at it, a function and its test), commit them together. Splitting
them would produce a commit that doesn't stand on its own.
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
Read the diff yourself (`git diff`, `git status`) and split it into
logical clusters by judgment — a heuristic like "group by file" is a
starting point, not a verdict: if two files are one logical change (a
function and its test, a doc and the index row pointing at it), commit
them together. Splitting them would produce a commit that doesn't stand on
its own. Write each commit message directly; there's no separate model
call to delegate this to here.
<!-- variant:end -->
<!-- variant:shared -->
Commits must follow Conventional Commits: `type(scope): concise imperative
description`.

- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`, `style`, `revert`
- Scope: whatever the project uses (check recent `git log`, or an existing
  `commitlint`/similar config).
<!-- variant:end -->
<!-- variant:chowa-only -->
In Chōwa's own repo the scopes are `core`, `adapters`, `router`, `git`,
`cli`, `integrations`.
<!-- variant:end -->

<!-- variant:shared -->
### Code Quality & Build Verification

Before committing, run the *project's own* test/lint/build scripts —
typically something like `test`, `lint`, `build` in its `package.json`
`scripts`, or whatever the project's own tooling is. This workflow's own
conventions (model routing, commit-splitting, or their absence) don't
replace a project's own quality gates.
<!-- variant:end -->

<!-- variant:shared -->
### Deterministic Workflow Enforcement via Agent Hooks

While workflow rules guide model turns, agent hooks enforce strict guardrails programmatically before tool execution:

1. **Push Protection Guard (`guard-push.mjs`)**:
   Hooked into `PreToolUse` for `Bash` commands in `hooks/hooks.json`. Inspects `git push` command lines and deterministically blocks direct pushes or deletes to protected branches (`main`, `master`).
2. **Spec Location Guard (`guard-spec.mjs`)**:
   Hooked into `PreToolUse` for `Bash`, `Write`, and `Edit` tools. Prevents creating or modifying root-level `spec.md` or `implementation_plan.md` files, enforcing persistence under `specs/<YYYY-MM-DD>-<slug>/`.
3. **Custom Hook Configuration**:
   Repositories using Chōwa can add or extend hooks in `.agents/hooks.json` or `hooks/hooks.json` to enforce quality gates deterministically prior to tool execution.
<!-- variant:end -->

<!-- variant:chowa-skill-only -->
### Delegation Guidance

There's no live routing policy to resolve here — no config file, no
provider API to query. Use this as a starting heuristic, and defer to
whatever the project's own conventions already say if they conflict:

| Task kind | Suggested approach |
|---|---|
| Mechanical (renames, formatting, boilerplate) — trivial, one-line | Handle inline yourself; the round-trip costs more than it saves. |
| Mechanical — large or repetitive (multi-file sweep, repo-wide pass) | Delegate via the `Agent` tool to a subagent pinned to a fast/cheap model (see below). |
| Refactor, debug, architecture, security | Primary session model — these need full context and judgment a cheaper model doesn't have. |
<!-- variant:end -->

<!-- variant:shared -->
### Delegating Mechanical Sub-Tasks
<!-- variant:end -->

<!-- variant:chowa-only -->
Not every step of a live pipeline needs the primary session's model. A
sub-task qualifies for delegation only if, before delegating, you can
state exactly what the correct output looks like (or exactly what
mechanical rule to apply) — renames, formatting passes, boilerplate
scaffolding, and the same shape of work `chowa commit`/`chowa pr` already
delegate on your behalf (a rigid, checkable output generated from an
already fully-specified input). If any part of "what should this become"
is still an open design question, don't delegate — handle it inline.

Skip delegation for trivial one-line edits — the round-trip costs more
than it saves. Delegate only when the mechanical work is large or
repetitive enough (a multi-file rename sweep, a repo-wide formatting pass)
that running it on a cheaper model is worth a subagent call.
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
A sub-task qualifies for delegation only if, before delegating, you can
state exactly what the correct output looks like (or exactly what
mechanical rule to apply). If any part of "what should this become" is
still an open design question, don't delegate — handle it inline.
<!-- variant:end -->

<!-- variant:chowa-only -->
To delegate, first resolve the target model — run `chowa route --kind
mechanical --complexity low` (the same profile `chowa commit`/`chowa pr`
already use) and read `target.model` from its JSON output. Then invoke the
`Agent` tool with `chowa:chowa-mechanical` as the subagent and that
resolved value as an explicit `model:` override — this takes precedence
over whatever the subagent definition's own frontmatter pins, so the
actual model always reflects the live routing policy (`chowa.config.ts`)
rather than a value hardcoded in the subagent file.
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
To delegate, invoke the `Agent` tool with the packaged mechanical subagent
as the target.
<!-- variant:end -->
<!-- variant:shared -->
Ask it to report back a structured summary of exactly what changed — not
just "done" — so you don't need to re-read every touched file yourself. If
the user has asked you to handle a specific step directly, that overrides
delegation for that step only. If the subagent hits something needing
judgment mid-task, expect it to stop and hand back rather than deciding on
its own.
<!-- variant:end -->

<!-- variant:shared -->
### PR Description Generation
<!-- variant:end -->

<!-- variant:chowa-only -->
```bash
chowa pr --base <branch>
```
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
Read the commit history and diff against the target base yourself
(`git log <base>..HEAD`, `git diff <base>...HEAD`), then write the PR
description directly — summary, changes, testing notes, and (for a
release/hotfix) a rollout/rollback plan. Open or update it with
`gh pr create` / `gh pr edit`.
<!-- variant:end -->

<!-- variant:shared -->
**⚠️ Experimental — Visual Proof (opt-in):** every PR description MUST
include a `### Visual Proof` section, placed after `### Summary`. If the
diff touches styling files (`*.css`, `*.scss`, `*.less`, Tailwind config),
UI/frontend components (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.html`),
or graphic assets/layout templates/theme definitions, attach visual
evidence — a screenshot, a before/after image table, a Playwright
snapshot, or a carousel — as markdown image links. For every other PR,
write `N/A (non-visual change)` in that section instead of omitting it.

```markdown
### Summary
<concise description of changes>

### Visual Proof
<!-- UI/styling changes: attach before/after screenshots, carousels, or
     image links. Non-visual changes: N/A (non-visual change). -->
![Visual Proof](<path-or-url>)

### Verification
<test & quality gate results>
```
<!-- variant:end -->

<!-- variant:shared -->
### Roadmap Visualization

**Trigger**: the user asks to see or visualize the roadmap, or to present
the project's development history.

**Data gathering**: read `specs/INDEX.md` first. Default to rich mode —
also read each referenced `spec.md`'s Problem Statement/Goals sections for
narrative depth. Switch to lean mode automatically once the index has more
than 20 entries (use only the `Date | Slug | Status | Summary` row, no
per-spec reads), or immediately if the user asked for something quick. Ask
directly whenever which mode is wanted is ambiguous.

**Before building**: give the page real visual design effort — a
considered palette, paired typefaces, and deliberate layout — the same
rigor as any presentation-quality deliverable. Not a plain list.

**Layout**: a chronological timeline ordered by date, with each entry
color-coded by status (`Draft`, `Approved`, `In Progress`, `Done`,
`Dismissed`, `Superseded by <link>`), a ⚠️ experimental marker surfaced
from a spec's own `Stability` field when present, a status filter, and
per-entry expand/collapse for the rich-mode narrative text.

**Output**: a fully self-contained HTML file (inline CSS/JS, no external
requests, both light and dark themes handled via `prefers-color-scheme`)
written to a local scratch path — never `specs/`, never committed — then
opened in the system default browser (`xdg-open`/`open`/`start`,
depending on OS). Report the local file path back to the user. This stays
entirely local: no upload, no network call, no claude.ai dependency.
<!-- variant:end -->

<!-- variant:shared -->
### ASD-STE100 Simplified Technical English Mode (Conversation Only)

When `"ste100": true` is set in `~/.chowa-skill/preferences.json` or `chowa.config.js`, all conversation text responses output to the user MUST follow ASD-STE100 Simplified Technical English:

1. **Active Voice & Imperative Verbs**: Use active voice only. Start instructions with strong imperative verbs (e.g., `Write`, `Update`, `Run`, `Verify`).
2. **Sentence Length Limits**:
   - Maximum 20 words for procedural steps and instructions.
   - Maximum 25 words for descriptive statements.
3. **One Instruction Per Sentence**: Write single, clear, un-nested sentences. Number procedural steps sequentially.
4. **Controlled Vocabulary**: Use plain technical English. Avoid passive phrasing, complex idioms, or ambiguous jargon.
<!-- variant:end -->

<!-- variant:shared -->
Whether the body comes from `chowa pr` or you write it directly, close
every PR with this line, on its own, after everything else:

```
調和 (Chōwa) — spec → plan → execute, verified before merge
```

Never the default Claude Code attribution trailer — this replaces it, it
doesn't sit alongside it.
<!-- variant:end -->
