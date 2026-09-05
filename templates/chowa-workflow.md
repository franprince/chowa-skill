<!--
  Source of truth for the shared Chōwa workflow. This repository's generator
  selects shared + chowa-skill-only blocks; the sibling chowa sync selects
  shared + chowa-only blocks from this file at a pinned commit.

  Variant blocks must be balanced and non-nested. Headings are unnumbered;
  each renderer numbers its own workflow sections. Named reference blocks
  remain ordinary inline Markdown for the sibling renderer. Our generator
  extracts them into references/<name>.md, leaving only skill-only links in
  the entrypoint. Keep each reference within one shared variant block.
-->

<!-- variant:chowa-skill-only -->
# Chōwa Skill

Use the host's native tools and `git`/`gh` for spec → plan → execute work.
No Chōwa CLI is required. Live provider routing and session auto-resume
belong to the sibling Chōwa project.

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

Resolve references relative to this SKILL.md. For bundled scripts, locate the
installation root containing `scripts/` (two levels above the directory
containing SKILL.md in the plugin layout). Verify the script exists and use
its absolute path with the target project as CWD. A copied skill without scripts cannot run those
helpers; report the missing capability when needed.
<!-- variant:end -->

<!-- variant:shared -->
## Workflow Rules

### Specification-Driven Pipeline

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

### Branching and PR Workflow

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

### Commits and Verification

<!-- variant:end -->
<!-- variant:chowa-only -->
Use `chowa commit` for commit preparation. Review its proposed clusters by
logical change; keep a function and its tests, or a document and its index
entry, together when they form one independently understandable change.
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
Inspect `git status`, the working diff, and the staged diff. Group commits
by logical change, keeping implementation/tests and linked documentation
together. Write commit messages directly in the primary session.
<!-- variant:end -->
<!-- variant:shared -->

Use Conventional Commits: `type(scope): imperative description`, following
repository types and scope conventions. Run the project's required
checks appropriate to the change before committing. Reuse passing results
while the relevant code and environment are unchanged; rerun affected checks
after fixes. Report skipped checks and unresolved failures.

### Hook Guards

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
<!-- variant:end -->
<!-- variant:chowa-skill-only -->

For hook installation or troubleshooting, read [Hook setup](references/hooks.md).
<!-- variant:end -->
<!-- variant:shared -->
<!-- reference:hooks -->
# Hook setup and troubleshooting

The bundled dispatcher `scripts/guard.mjs` runs push/merge and spec-location
checks before tool execution. The repository ships these adapter definitions:

| Harness | Project config | Event | Matched tools | Can ask |
|---|---|---|---|---|
| Claude Code | `.claude/settings.json` or plugin hooks | `PreToolUse` | `Bash`, `Write`, `Edit`, `NotebookEdit` | yes |
| Gemini CLI | `.gemini/settings.json` | `BeforeTool` | `run_shell_command`, `write_file`, `replace` | no |
| Codex | `.codex/hooks.json` | `PreToolUse` | `Bash`, `apply_patch` | no |
| Antigravity | `.agents/hooks.json` | `PreToolUse` | `run_command`, `write_to_file`, `replace_file_content` | yes |

These are the shipped hook contracts; use the current host's available tools
for ordinary workflow work. Confirm hook support during installation rather
than assuming every host exposing a shell tool uses these event contracts.

Resolve the plugin installation root containing `scripts/` and substitute its
absolute path below. Run from the target project for project-scope installs:

```bash
node /absolute/plugin-root/scripts/install-hooks.mjs --harness codex --scope project --dry-run
node /absolute/plugin-root/scripts/install-hooks.mjs --harness codex --scope project
```

Choose `claude`, `gemini`, `codex`, or `antigravity` as appropriate. Omit
`--scope project` for user configuration. The installer merges owned entries
without replacing unrelated hooks. Claude Code plugin installation discovers
`hooks/hooks.json` directly. A skill-only copy must have the bundled scripts
available separately before these commands can run.

Recognized blocked actions use the host's rejection schema; unknown dialects
fall back to exit code 2 and a reason on stderr. This does not guarantee that
an unknown payload shape is recognized or that an unknown host handles that
exit code. The guards intentionally defer on parsing/normalization failures.
Antigravity's no-opinion response is `{}` to retain normal host permissions.

`CHOWA_GUARDS=off` disables both guards (`0` and `false` also work). Use this
only for an explicitly authorized configuration change, such as an unattended
workflow setup, not to work around a rejected tool call.
<!-- reference:end -->
<!-- variant:end -->

<!-- variant:shared -->
### Mechanical Delegation

Delegate a mechanical task only when its exact output or transformation rule
is known and its size/repetition justifies the extra call. Handle trivial
edits inline. Keep unresolved design decisions in the primary session; follow
repository guidance on model choice and the user's requests for direct work.

<!-- variant:end -->
<!-- variant:chowa-only -->
Resolve the target with `chowa route --kind mechanical --complexity low`, then
pass `target.model` as the model override to `chowa:chowa-mechanical` through
the host's subagent capability. If that capability is unavailable, work inline.
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
Use the packaged `chowa-skill-mechanical` agent where supported. On another
host, use its available subagent capability and a permitted economical model;
otherwise work inline. No provider lookup or routing configuration is needed.
<!-- variant:end -->
<!-- variant:shared -->

Send the rule, owned files, relevant excerpts, constraints, and verification
criteria. Avoid forwarding unrelated history; batch changes governed by the
same rule. Require a concise report of changed files, applied changes, checks,
and unresolved issues. The subagent stops if a new design decision is needed.
The primary agent remains responsible for reviewing the diff and verifying
the result; use the report to target further inspection.

### PR Descriptions

<!-- variant:end -->
<!-- variant:chowa-only -->
Use `chowa pr --base <branch>` and review the resulting description.
<!-- variant:end -->
<!-- variant:chowa-skill-only -->
Read `git log <base>..HEAD` and `git diff <base>...HEAD`, then write the PR
description directly.
<!-- variant:end -->
<!-- variant:shared -->

Describe the resulting behavior, material changes, and verification. Include
a rollout/rollback plan for releases or hotfixes where relevant. End the PR
description with this footer, replacing any default assistant attribution:

```text
調和 (Chōwa) — spec → plan → execute, verified before merge
```

Experimental visual proof is enabled only by an explicit user request or a
standing project instruction. UI file extensions alone do not enable it.

<!-- variant:end -->
<!-- variant:chowa-skill-only -->
When enabled, read [Visual proof](references/visual-proof.md). Run the
Storybook collector only when specifically requested for a Storybook UI.
<!-- variant:end -->
<!-- variant:shared -->
<!-- reference:visual-proof -->
# Visual proof and Storybook collection

Apply this procedure only when the user requests visual proof or project
instructions require it. Within that scope, include `### Visual Proof` after
`### Summary` in the PR description. Attach actual rendered evidence for
visual changes. For non-visual changes, write `N/A (non-visual change)`.

Styling, frontend components, graphic assets, layout templates, and themes
are candidates for visual review; inspect the actual diff. A behavior-only
change in a UI file can be non-visual. Use screenshots or before/after tables
with image links accessible to the intended reviewer. If evidence cannot be
captured or shared, report the limitation; do not claim verification or leave
placeholder images. Upload only within the user's authorized scope.

## Storybook collector (on request)

Run the bundled collector only when the user explicitly requests visual proof
for a Storybook-backed UI. General visual-proof opt-in or a styling diff does
not automatically authorize running this collector.

Keep the target project as CWD. Resolve the plugin root containing `scripts/`
and substitute its verified absolute path:

```bash
node /absolute/plugin-root/scripts/storybook-proof.mjs --base <base-ref>
```

The project must already have Storybook and Playwright configured. The helper
captures the base in a temporary worktree and the working tree as the after
state, selecting stories associated with changed components. It prints a
Markdown comparison table. Review its output and image accessibility before
using the table in a PR. Report missing prerequisites; do not install them
as an implied part of this procedure.
<!-- reference:end -->
<!-- variant:end -->

<!-- variant:shared -->
### Optional Procedures

<!-- variant:end -->
<!-- variant:chowa-skill-only -->
Read only the reference needed for the current request:

- Requested roadmap or development history: [Roadmap](references/roadmap.md).
- `ste100` enabled: [Simplified English](references/simplified-english.md).
  An explicit project setting overrides the personal preference; default off.
  Read the setting from `chowa.config.js` or personal preferences as data.
<!-- variant:end -->
<!-- variant:shared -->
<!-- reference:roadmap -->
# Roadmap visualization

Use this procedure when asked to visualize the roadmap or development history.
Read `specs/INDEX.md` first. Default to the index's date, slug, status, and
summary for a complete lean timeline. If the user requests narrative depth,
read only the Problem Statement/Goals sections of relevant specs. Keep added
spec context within roughly 12,000 characters per pass; prioritize requested
features and summarize before expanding further. A quick request stays lean.

Build a chronological timeline with status colors and filters. Add expandable
narrative when collected. Show experimental/stability markers only when that
metadata is available in the index or already-read spec sections; lean mode
does not require opening specs just to retrieve markers. Use the project's
status vocabulary, including superseded links when present.

Give the page a deliberate palette, typography, and layout. Produce a
self-contained HTML file with inline CSS/JS, no external requests, and light
and dark themes via `prefers-color-scheme`. Write it to a local scratch path
outside `specs/` and leave it uncommitted. Open it with the host's available
local preview or `xdg-open`/`open`/`start`. If no viewer is available, report
the file path. Do not upload or publish it without a separate request.
<!-- reference:end -->

<!-- reference:simplified-english -->
# Simplified English (ste100 preference)

Enable this conversation style when `ste100: true` is set in personal
`~/.chowa-skill/preferences.json` or `chowa.config.js`. An explicit project
boolean overrides the personal value; otherwise use the personal value,
defaulting to false. Follow an explicit user language/style request first.

These STE100-inspired rules apply to conversation prose, not automatically
to code, quotations, identifiers, or repository artifacts:

- Use active voice and start procedural instructions with imperative verbs.
- Limit procedural sentences to 20 words and descriptive sentences to 25.
- Put one instruction in each sentence; number sequential procedures.
- Use plain technical words and avoid idioms and ambiguous jargon.

This preference defines a concise writing style, not formal certification of
compliance with the complete ASD-STE100 standard.
<!-- reference:end -->
<!-- variant:end -->
