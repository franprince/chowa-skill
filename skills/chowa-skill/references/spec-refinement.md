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

Record `Status: active` on explicit acceptance. Keep only the current round,
settled decisions, explicit assumptions, deferred scope, and unanswered blockers;
do not copy the full interview transcript. Use these states consistently:

| State | Meaning on resumption |
|---|---|
| `pending` | Offer awaiting an answer; do not start the interview or plan |
| `active` | Resume from the unanswered questions or spec confirmation |
| `declined` | Skip the optional interview; preserve ordinary clarification |
| `completed` | Updated spec confirmed; continue within existing authorization |
| `stopped` | User ended the interview; do not restart without a request |

An explicit request to begin overrides a previous declined or stopped state.
Do not repeat questions whose answers are already recorded.

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
4. Use the host's question tool where available, otherwise numbered questions in
   conversation. Wait for answers before dependent questions or planning.
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
plan current; resolve material scope changes using the shared authorization rules.

Continue with [Pipeline](pipeline.md) only if planning or implementation is
already requested or authorized. Otherwise return the refined spec and stop.
Do not re-request an approval that this confirmation or an earlier instruction
already supplies, and do not treat interview consent as authorization to build.
