# Implementation plan

1. Extract existing pipeline, delivery, and delegation procedures into generated
   references. Keep activation, scope, path conventions, and routing in the core.
2. Add optional spec-refinement routing at the draft-to-plan boundary and a
   self-contained procedure with durable state, bounded rounds, and exit rules.
3. Document the architecture choice and example user-facing offer in the README.
   Update the generator's reference inventory checks; retain runtime packaging.
4. Validate generation, native skill schema, core size, and repository tests.
   Review realistic offer/decline/resume/stop/explicit-request scenarios against
   the instructions without claiming unperformed live model evaluations.

Apply this as a follow-up to the existing portability PR. Release versioning
continues through its feature commit and the repository's release workflow.

## Verification

- All 130 repository tests pass, including a new invariant checking local links
  between generated Markdown files. All 22 generated artifacts are synchronized.
- Skill-creator validation and Claude's native skill validation pass. Host
  runtime adapters are unchanged from the portability checks in the preceding
  specification; native model conversations were not run for this change.
- The core decreased from 10,092 to 6,016 characters (40.4%), approximately
  2,523 to 1,504 tokens at characters / 4. Its enforced budget is now 7,000
  characters. Optional refinement content is excluded until selected.

The following is an instruction review, not an automated model evaluation:

| Scenario | Specified result |
|---|---|
| Fresh spec, user requests planning | Offer once; persist pending and await a choice |
| Explicit roast request | Enter active refinement directly without re-offering |
| Feature request only discusses adding this capability | Implement the feature; do not interview the user |
| User declines or requests no optional questions | Record declined; normal clarification remains available |
| No answer to offer | Wait before planning; independent research may continue |
| Resume active interview after interruption | Read saved decisions; resume outstanding questions or confirmation |
| Resume declined, stopped, or completed interview | Preserve state; no repeated offer |
| Spec-only request | Return the spec; defer the optional offer until planning is requested |
| User stops or round limit is reached | Stop questions; summarize; further rounds need a user choice |
| Unresolved essential requirement after skipping | Ask necessary ordinary clarification rather than inventing a decision |
| Explicit refinement changes an approved plan | Mark affected plan/tasks for revision before execution |
| Commit/PR-only or trivial edit | Route directly; no spec creation or roast offer |

Review corrections clarified active-state resumption and invalidation of affected
plan/tasks after changing approved requirements. This review checks instruction
coverage; real conversations can still expose behavioral issues.
