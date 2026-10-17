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
