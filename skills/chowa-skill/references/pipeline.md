# Specification, planning, and execution

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
   approval before planning unless that scope is already authorized. Before the
   first planning transition, follow the refinement choice below.
4. **Plan and tasks:** describe files, components, and verification in
   `implementation_plan.md`; create `tasks.md` with concrete checkable items
   and their dependencies. Review both together before coding, using existing
   authorization where applicable.
5. **Coverage:** for complex changes, map acceptance criteria to plan/tasks
   before execution. Correct routine omissions within scope; raise unresolved
   requirements or scope changes with the user.
6. **Execute and verify:** implement the plan, check off tasks as completed,
   and run applicable project quality gates. For commits or PRs, read
   [Delivery](delivery.md). For worthwhile, authorized mechanical delegation,
   read [Delegation](delegation.md). Mirror tasks into host tracking
   only when useful. Resume from the durable checklist after interruption.

Persist `spec.md`, `implementation_plan.md`, and `tasks.md` under
`specs/<YYYY-MM-DD>-<slug>/`. Create or update `specs/INDEX.md` with a
`Date | Slug | Status | Summary` row. Maintain the project's status vocabulary;
if none exists, use `Draft`, `Approved`, `In Progress`, `Done`, `Dismissed`,
or `Superseded by <link>`. Keep the index and feature status consistent.

## Optional refinement before planning

After drafting a new feature spec, offer once before starting its implementation
plan: “Want a spec roast before planning? I’ll challenge the assumptions, edge
cases, and acceptance criteria. You can skip it or stop at any time.”

Use the host's question tool if available, otherwise ask in conversation.
Offer “Roast the spec” and “Continue to planning” as choices. An explicit roast
request already opts in; an explicit skip or request for no optional questions
already opts out. Record the choice under `## Spec refinement` in the feature
spec. If an offer is unanswered, record `pending` and wait before planning;
continue only independent fact-finding. Do not infer a choice from silence.

On acceptance, record `active` and read [Spec refinement](spec-refinement.md).
On decline, record `declined` and continue within the authorized scope, resolving
any essential blockers through normal clarification. If the user only requested
a spec, stop at that scope boundary; offer when planning is later requested.

An existing draft with no refinement choice receives the offer when first-time
planning is requested. On resumption, keep an unanswered offer `pending`; for
`active`, load the refinement procedure and resume its outstanding questions or
confirmation before planning. Do not re-offer after `declined`,
`completed`, or `stopped`; revisit only on an explicit request. An already
approved plan skips this offer unless the user asks to refine its spec. A
newly discovered ambiguity still receives ordinary clarification. Recording a
roast choice is not a replacement for the task's existing approval rules.
