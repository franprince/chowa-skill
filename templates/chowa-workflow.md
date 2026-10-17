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

<!-- reference:host-capabilities -->
# Host capabilities

Procedures in this skill name a capability, never a host's tool. Map each one
to the current host's tool when it has one; otherwise use the fallback. Never
stop because a named tool is absent, and never assume one host has a tool
because another does.

| Capability | Use it to | Fallback |
|---|---|---|
| `ask_user` | Offer a discrete choice or request an approval | Ask in conversation with numbered options, then wait for the answer |
| `track_tasks` | Show in-session progress on `tasks.md` items | Keep `tasks.md` current; it stays the durable record either way |
| `delegate` | Hand a qualifying mechanical task to a subagent | Do the work inline |
| `run_shell` | Run `git`, `gh`, bundled helpers, and quality gates | Ask the user to run the command and share its output |
| `edit_files` | Create and change files | Give the user the exact change to apply |

## Known mappings

| Capability | Claude Code | Codex | Gemini CLI | Antigravity |
|---|---|---|---|---|
| `ask_user` | `AskUserQuestion` | — | — | — |
| `track_tasks` | `TaskCreate` (older: `TodoWrite`) | `update_plan`, when enabled | `write_todos` | — |
| `delegate` | `Agent` | — | — | — |
| `run_shell` | `Bash` | — | `run_shell_command` | `run_command` |
| `edit_files` | `Write`, `Edit` | `apply_patch` | `write_file`, `replace` | `write_to_file`, `replace_file_content` |

A dash means no mapping is recorded here, not that the host lacks the
capability. On any host, and for any host not listed, match tools by what
they do rather than by name.
<!-- reference:end -->

<!-- reference:hooks -->
# Hook setup and troubleshooting

The bundled dispatcher `scripts/guard.mjs` runs push/merge and spec-location
checks before tool execution. Push/merge protection applies in every project
and asks for approval of recognized protected-branch pushes, deletes, and
merges, or denies where the host cannot ask. Spec-location protection applies
only with persistent opt-in. Guards do not infer conversational approval.

| Harness | Project config | Event | Matched tools | Can ask |
|---|---|---|---|---|
| Claude Code | `.claude/settings.json` or plugin hooks | `PreToolUse` | `Bash`, `PowerShell`, `Write`, `Edit`, `NotebookEdit` | yes |
| Gemini CLI | `.gemini/settings.json` | `BeforeTool` | `run_shell_command`, `write_file`, `replace` | no |
| Codex | `.codex/hooks.json` | `PreToolUse` | `Bash`, `apply_patch` | no |
| Antigravity | `.agents/hooks.json` | `PreToolUse` | `run_command`, `write_to_file`, `replace_file_content` | yes |

Confirm hook support during installation rather than assuming every host with
a shell tool uses these event contracts. Substitute the absolute skill
directory below and run from the target project for project-scope installs:

```bash
node /absolute/skill-root/scripts/install-hooks.mjs --harness codex --scope project --dry-run
node /absolute/skill-root/scripts/install-hooks.mjs --harness codex --scope project
```

Choose `claude`, `gemini`, `codex`, or `antigravity`. Omit `--scope project`
for user configuration. The installer merges owned entries without replacing
unrelated hooks. Claude Code plugin installation discovers `hooks/hooks.json`
directly; standalone skill installations need this explicit setup.

For Codex, review and trust the installed commands with `/hooks`; changed hook
commands are skipped until trusted, and project configuration also requires
project trust. User installs respect `CODEX_HOME`. Gemini disables project
hooks and workspace skill discovery in untrusted folders. Reload or restart
the host when required, then confirm the hooks appear in its hook viewer.

Adapter contracts: [Claude Code](https://code.claude.com/docs/en/hooks),
[Codex](https://learn.chatgpt.com/docs/hooks), and
[Gemini CLI](https://geminicli.com/docs/hooks/reference/). Hooks are workflow
checks, not a shell sandbox. Blocked actions use the host's rejection schema;
unknown dialects get exit code 2 with a reason on stderr. Guards defer to
normal host permissions on malformed or unrecognized payloads; Antigravity's
no-opinion response is `{}`.

`CHOWA_GUARDS=off` disables both guards (`0` and `false` also work). Use this
only for an explicitly authorized configuration change, such as an unattended
workflow setup, not to work around a rejected tool call.
<!-- reference:end -->

<!-- reference:visual-proof -->
# Visual proof and Storybook collection

Include `### Visual Proof` after `### Summary` in the PR description. Attach
actual rendered evidence for visual changes. For non-visual changes, write
`N/A (non-visual change)`.

Styling, frontend components, graphic assets, layout templates, and themes
are candidates for visual review; inspect the actual diff. A behavior-only
change in a UI file can be non-visual. Use screenshots or before/after tables
with image links accessible to the intended reviewer. If evidence cannot be
captured or shared, report the limitation; do not claim verification or leave
placeholder images. Upload only within the user's authorized scope.

## Storybook collector (on request)

Run the bundled collector only when the user explicitly requests visual proof
for a Storybook-backed UI. General visual-proof opt-in or a styling diff does
not authorize it. Keep the target project as CWD and substitute the verified
absolute skill directory:

```bash
node /absolute/skill-root/scripts/storybook-proof.mjs --base <base-ref>
```

The project must already have Storybook and Playwright configured. The helper
captures the base in a temporary worktree and the working tree as the after
state, selecting stories associated with changed components. It prints a
Markdown comparison table. Review its output and image accessibility before
using the table in a PR. Report missing prerequisites; do not install them
as an implied part of this procedure.
<!-- reference:end -->

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

Follow an explicit user language or style request first. These
STE100-inspired rules apply to conversation prose, not automatically to code,
quotations, identifiers, or repository artifacts:

- Use active voice and start procedural instructions with imperative verbs.
- Limit procedural sentences to 20 words and descriptive sentences to 25.
- Put one instruction in each sentence; number sequential procedures.
- Use plain technical words and avoid idioms and ambiguous jargon.

This is a concise writing style, not certified ASD-STE100 compliance.
<!-- reference:end -->

<!-- reference:pipeline -->
# Specification, planning, and execution

Use these stages for features and non-trivial changes, within the requested
scope.

1. **Project principles:** read `specs/CONSTITUTION.md` if present. Before a
   project's first spec, offer to draft it without blocking the task. Flag
   conflicts with its principles; agree on material changes with the user.
2. **Backlog:** for work spanning dependent phases or multiple PRs, record
   milestones and execution order in `specs/BACKLOG.md`.
3. **Spec:** write the problem, goals, non-goals, relevant inputs/outputs,
   edge cases, and acceptance criteria. Resolve ambiguities that affect
   scope or acceptance; state reasonable implementation assumptions. Obtain
   approval before planning unless that scope is already authorized, then
   apply the refinement choice below.
4. **Plan and tasks:** describe files, components, and verification in
   `implementation_plan.md`; create `tasks.md` with concrete checkable items
   and their dependencies. Review both together before coding.
5. **Coverage:** for complex changes, map acceptance criteria to plan/tasks
   before execution. Correct routine omissions within scope; raise unresolved
   requirements or scope changes with the user.
6. **Execute and verify:** implement the plan, check off tasks as completed,
   and run applicable project quality gates. For commits or PRs, read
   [Delivery](delivery.md). For worthwhile, authorized mechanical delegation, read
   [Delegation](delegation.md). Mirror tasks with `track_tasks` only when
   useful. Resume from the durable checklist after interruption.

Persist `spec.md`, `implementation_plan.md`, and `tasks.md` under
`specs/<YYYY-MM-DD>-<slug>/`. Create or update `specs/INDEX.md` with a
`Date | Slug | Status | Summary` row. Maintain the project's status vocabulary;
if none exists, use `Draft`, `Approved`, `In Progress`, `Done`, `Dismissed`,
or `Superseded by <link>`. Keep the index and feature status consistent.

## Optional refinement before planning

Before first-time planning of a spec with no recorded refinement choice, offer
once: “Want a spec roast before planning? I’ll challenge the assumptions, edge
cases, and acceptance criteria. You can skip it or stop at any time.” Offer
“Roast the spec” and “Continue to planning” as choices. An explicit roast
request already opts in; an explicit skip or request for no optional questions
already opts out. An already approved plan skips the offer unless the user
asks to refine its spec. If the user only requested a spec, stop there and
offer when planning is later requested.

Record the choice under `## Spec refinement` in the feature spec:

| State | Meaning |
|---|---|
| `pending` | Offer unanswered; wait before planning, continuing only independent fact-finding. Never infer a choice from silence |
| `active` | Read [Spec refinement](spec-refinement.md) and resume its outstanding questions or confirmation before planning |
| `declined` | Continue to planning; resolve essential blockers through ordinary clarification |
| `completed` | Updated spec confirmed; continue within existing authorization |
| `stopped` | User ended the interview; do not restart without a request |

Do not re-offer after `declined`, `completed`, or `stopped`. Newly discovered
ambiguity still receives ordinary clarification, and a roast choice never
replaces the task's approval rules.
<!-- reference:end -->

<!-- reference:delivery -->
# Commits and pull requests

Use this procedure for requested or already authorized commit/PR work, and for
branch setup when preparing implementation. A standalone delivery request does
not trigger spec creation or a refinement offer. Read only the current diff,
relevant history, and applicable project instructions.

## Branching and PR Workflow

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
  publishing it.
- Use `gh pr create` / `gh pr edit`. Check mergeability with
  `gh pr view <n> --json mergeable,mergeStateStatus` and required checks with
  `gh pr checks <n>`. Resolve base conflicts on the topic branch, verify,
  and push within the authorized scope. Pending, unknown, or failing checks
  must be reported accurately; they do not establish readiness.

## Commits and Verification

Inspect `git status`, the working diff, and the staged diff. Group commits
by logical change, keeping implementation/tests and linked documentation
together. Write commit messages directly in the primary session.

Use Conventional Commits: `type(scope): imperative description`, following
repository types and scope conventions. Run the project's required
checks appropriate to the change before committing. Reuse passing results
while the relevant code and environment are unchanged; rerun affected checks
after fixes. Report skipped checks and unresolved failures.

## PR Descriptions

Read `git log <base>..HEAD` and `git diff <base>...HEAD`, then write the PR
description directly.

Describe the resulting behavior, material changes, and verification. Include
a rollout/rollback plan for releases or hotfixes where relevant. End the PR
description with this footer in place of any default assistant attribution,
unless the user, repository, or host requires a specific attribution:

```text
調和 (Chōwa) — spec → plan → execute, verified before merge
```

When visual proof is enabled, follow [Visual proof](visual-proof.md).
<!-- reference:end -->

<!-- reference:delegation -->
# Mechanical delegation

Delegate a mechanical task only when its exact output or transformation rule
is known and its size/repetition justifies the extra call. Handle trivial
edits inline. Keep unresolved design decisions in the primary session; follow
repository guidance on model choice and the user's requests for direct work.

The optional Claude Code plugin supplies `chowa-skill-mechanical`. For a
standalone skill or another host, use `delegate` with a permitted model
when available; otherwise execute inline. Never assume a named agent or model
exists across hosts.

Send the rule, owned files, relevant excerpts, constraints, and verification
criteria. Avoid forwarding unrelated history; batch changes governed by the
same rule. Require a concise report of changed files, applied changes, checks,
and unresolved issues. The subagent stops if a new design decision is needed.
The primary agent remains responsible for reviewing the diff and verifying
the result; use the report to target further inspection.
<!-- reference:end -->

<!-- reference:spec-refinement -->
# Optional spec roast

Use only after the user accepts the pipeline's offer or explicitly requests a
spec roast, grilling, or requirements stress-test. Merely discussing adding this
capability does not start an interview. This procedure is self-contained and
uses the current host's tools; no separate grilling skill or subagent is required.

## Entry and durable state

Read the current feature spec and its `## Spec refinement` section. If invoked
without a draft, read [Pipeline](pipeline.md) for the spec fields and turn the
available request into a concise draft. The explicit roast request already
answers its offer; ask only for missing information needed to draft the spec.
Persist it in `specs/<YYYY-MM-DD>-<slug>/spec.md` and update `specs/INDEX.md`.
Refinement alone does not authorize an implementation plan or code changes.

Record `active` on acceptance, `completed` once the updated spec is confirmed,
and `stopped` if the user ends the interview. An explicit request to begin
overrides a previous `declined` or `stopped` state. Keep only the current
round, settled decisions, explicit assumptions, deferred scope, and unanswered
blockers; do not copy the transcript or repeat answered questions.

## Focused challenge rounds

Challenge the specification directly and respectfully. “Roast” means probing
weak reasoning and vague requirements, not ridiculing the user. Be specific
about the consequence: “Instant search is not testable; what latency and data
volume must the acceptance test cover?” Avoid performative insults or invented
problems used only to prolong the interview.

1. Inspect relevant repository evidence first. Distinguish facts you can verify
   from decisions or context only the user can provide. Use native read/search
   tools; delegate fact-finding only when independently authorized and worthwhile.
2. Identify the most consequential unresolved requirements: intended users and
   outcomes, scope exclusions, observable success, failure and recovery behavior,
   relevant data/permission boundaries, compatibility, and material tradeoffs.
   Apply only dimensions relevant to this feature; do not turn this into an
   exhaustive checklist or prematurely design the implementation.
3. Ask one to three independent questions per round. For each, give the reason
   it matters and a recommended answer with its tradeoff. Label recommendations
   as proposals, not agreed requirements. Defer questions that depend on an
   unanswered choice to a later round.
4. Ask with `ask_user`; its fallback is numbered questions in conversation. Wait for answers before dependent questions or planning.
   Research independent facts while waiting; do not guess the user's decisions.
5. Update the actual requirements and acceptance criteria after each answered
   round. Record intentional exclusions and assumptions explicitly, and keep
   unresolved blockers visible. Resolve conflicts with earlier answers rather
   than silently replacing an agreed requirement.

Default to a short pass of at most three rounds. Stop earlier when the important
requirements are sufficiently clear and testable. At the limit, summarize what
remains and let the user choose another bounded pass, explicit deferral, or
ending refinement. Never continue an open-ended interview merely to visit every
possible branch of an idea.

## Exit and handoff

If the user says stop, immediately record `stopped`, save the answers already
given, and identify remaining blockers. Do not ask further roast questions.
An instruction such as “stop roasting and plan” resumes normal planning within
its authorized scope; unresolved decisions essential to a valid plan still need
ordinary clarification. Ending the interview does not silently settle them.

When the pass is sufficient, show a concise summary of the changed requirements,
acceptance criteria, and any explicit deferrals. Ask the user to confirm that
this updated spec captures their intent; reuse confirmation already given for
that same revision. Keep the state `active` until confirmed, then set `completed`.

If refinement changes requirements covered by an existing plan, mark affected
plan/tasks for revision before execution. Earlier approval does not make a stale
plan current; material scope changes need renewed agreement.

Continue with [Pipeline](pipeline.md) only if planning or implementation is
already requested or authorized; otherwise return the refined spec and stop.
Do not re-request approval this confirmation or an earlier instruction already
supplies.
<!-- reference:end -->
