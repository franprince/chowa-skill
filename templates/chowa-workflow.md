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
mechanical delegation, and pre-tool-use guards that run under Claude
Code, Gemini CLI, Codex, and Antigravity alike). If a project wants the
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

1. **Constitution Check (`specs/CONSTITUTION.md`)** — if this is the
   project's first spec and `specs/CONSTITUTION.md` doesn't exist, offer
   to draft one collaboratively with the user (domain principles,
   non-negotiables, style conventions) before Stage 1. Decline is fine —
   this step never blocks the pipeline. If it exists, Stage 1 drafting
   must read it and stay consistent with it; a spec that would conflict
   with the constitution gets flagged to the user rather than silently
   drafted around it. Lives once per project, not per-feature — updated
   in place when principles change, with the change called out to the
   user since it affects every future spec.
2. **Stage 0: Backlog Breakdown (`specs/BACKLOG.md`)** — for complex tasks
   spanning multiple modules, dependent phases, or multiple PRs, create
   `specs/BACKLOG.md` first to outline epic milestones, sub-tasks, and
   execution order before breaking individual tasks into specs.
3. **Stage 1: Specification (`spec.md`)** — problem statement, goals,
   non-goals, input/output schemas, edge cases, and acceptance criteria.
   Before requesting approval, run a clarification pass over the draft:
   scan it for ambiguous or underspecified requirements — vague
   acceptance criteria, unstated edge-case behavior, conflicting goals —
   and resolve them with the user (`AskUserQuestion` for discrete
   choices, plain questions otherwise), updating the draft accordingly.
   Get explicit user approval before Stage 2.
4. **Stage 2: Implementation Plan (`implementation_plan.md`)** — files to
   modify/create, component boundaries, test plan. Once approved, break
   it into a persisted `tasks.md` — a checklist of discrete,
   independently-completable work items, each stated concretely enough to
   hand to delegation or execute directly. Get explicit user approval
   before writing code.
5. **Persistence** — write `spec.md`, `implementation_plan.md`, and
   `tasks.md` to `specs/<YYYY-MM-DD>-<slug>/`, never as loose root-level
   files, and add a row to `specs/INDEX.md` (create that layout if the
   project doesn't have one yet). Root-level files get overwritten by the
   next feature's docs with no record of what was approved — that's how
   intent drifts across iterations.
6. **Analyze** — cross-check `spec.md`'s goals/acceptance criteria against
   `implementation_plan.md`'s (and `tasks.md`'s) coverage: every goal
   traceable to at least one plan component/task, no plan component
   without a goal it serves. Report findings to the user rather than
   silently resolving them — they decide whether to revise or proceed.
   Skippable at the same judgment threshold as Stage 0 (a small, obvious
   change doesn't need a formal pass).
7. **Stage 3: Execution & Verification** — implement the approved plan
   (code + tests), mirroring `tasks.md`'s items into ephemeral
   `TaskCreate` entries for in-session tracking (`tasks.md` stays the
   durable record), then verify with the project's own quality gates (see
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

Workflow rules guide model turns; hooks enforce the two rules that must
not depend on a model reading prose. Both run before tool execution,
through one dispatcher (`scripts/guard.mjs`):

1. **Push Protection Guard (`guard-push.mjs`)** — stops code landing on a
   branch without a human saying so. That covers pushes (and deletes)
   whose *destination* is `main`/`master`, leaving the `release/*` →
   `main` flow alone, and it covers **merges**, which never invoke
   `git push` at all: `gh pr merge`, the equivalent `gh api .../merge`
   call, and `git merge` while a protected branch is checked out.
   Opening the PR and reporting it green is where the agent's job ends;
   merging is the human's decision. Merges ask regardless of destination
   rather than resolving the base over the network — `gh pr merge` with
   no arguments merges the current branch's PR, and a hook that made an
   API call would put that latency on every shell command and fail open
   whenever it failed. It **asks** rather than denies where the harness
   can route a decision to the user. Applies in every project: it encodes
   no Chōwa-specific convention.
2. **Spec Location Guard (`guard-spec.mjs`)** — stops root-level
   `spec.md`, `implementation_plan.md`, and `tasks.md` from being created
   or edited, so specs persist under `specs/<YYYY-MM-DD>-<slug>/`. It
   **denies**, with the correct location in the reason, since the agent
   can act on that itself. Applies only where Step 0's opt-in signals
   hold — a root `tasks.md` is an ordinary file in an unrelated project.
3. **Escape hatch** — `CHOWA_GUARDS=off` in the environment disables both,
   for the cases neither decision covers (bootstrapping a repository,
   unattended runs).

Hooks are supported on **Claude Code**, **Gemini CLI**, **Codex
(ChatGPT)**, and **Antigravity**. Each names the event, the tools, the
payload, and the deny schema differently; the guards decide once against
a normalized request and the verdict is rendered per harness:

| | Claude Code | Gemini CLI | Codex | Antigravity |
|---|---|---|---|---|
| Config | plugin `hooks/hooks.json`, or `.claude/settings.json` | `.gemini/settings.json` | `.codex/hooks.json` or `config.toml` | `.agents/hooks.json`, or `~/.gemini/config/hooks.json` |
| Event | `PreToolUse` | `BeforeTool` | `PreToolUse` | `PreToolUse` |
| Tools matched | `Bash`, `Write`, `Edit`, `NotebookEdit` | `run_shell_command`, `write_file`, `replace` | `Bash`, `apply_patch` | `run_command`, `write_to_file`, `replace_file_content` |
| Tool call shape | `tool_name` + `tool_input` | same | same | `toolCall.name` + `toolCall.args`, PascalCase |
| Can ask the user | yes | no | no | yes |

Install into a harness with
`node scripts/install-hooks.mjs --harness <claude|gemini|codex|antigravity>`
(`--scope project` for this repository only, `--dry-run` to preview).
Claude Code needs no install step when this is used as a plugin.

A harness that declares none of the above still blocks: Claude Code,
Gemini CLI, and Codex all treat exit code 2 with a reason on `stderr` as
a rejection, so an unrecognized harness degrades to a coarser message,
never to a silent allow. Antigravity doesn't document exit codes, which
is why it is declared explicitly rather than left to that fallback — and
why its no-opinion response is an empty object rather than
`{"decision": "allow"}`, which would auto-approve calls the user would
otherwise have been asked about.
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
### Storybook Before/After Visual Proof (On-Request)

When the user explicitly asks for visual proof of a Storybook-backed UI
change — not automatically, and not implied merely by a diff touching
styling files — run:

```bash
node scripts/storybook-proof.mjs --base <base-ref>
```

Requires the target project to already have Storybook and Playwright
configured; the script exits with a clear message if either is missing
rather than attempting to install them. It captures "before" screenshots
from a temporary worktree at `<base-ref>` and "after" screenshots from
the current working tree, for the stories belonging to components the
diff actually touched, and prints a ready-to-paste Markdown before/after
table for the `### Visual Proof` PR section.
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
