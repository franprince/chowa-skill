# Tasks: Constitution, Clarify, Tasks, and Analyze Stages for the Spec Pipeline

- **Date**: 2026-08-13
- **Status**: Draft
- **Slug**: `speckit-inspired-stages`

1. [ ] Edit `templates/chowa-workflow.md`: replace the 5-item
   Specification-Driven Pipeline list with the 7-item list (Constitution
   Check, Stage 0, Stage 1 + Clarify, Stage 2 + Tasks, Persistence,
   Analyze, Stage 3), all as `shared` content.
2. [ ] Run `node scripts/generate-skill.mjs` to regenerate
   `skills/chowa-skill/SKILL.md` from the updated template.
3. [ ] Edit `scripts/guard-spec.mjs`: extend `isRootSpecPath` to match
   `tasks.md`; update both blocked-reason strings in `decide()` to mention
   `tasks.md`; update the file-list mention in the header JSDoc comment.
4. [ ] Edit `tests/guard-spec.test.mjs`: add `tasks.md` cases parallel to
   the existing `spec.md` / `implementation_plan.md` cases.
5. [ ] Run `node --test tests/*.mjs` — full suite green.
6. [ ] Run `node scripts/generate-skill.mjs --check` — confirms
   `SKILL.md` is in sync with the template.
7. [ ] Commit in logical clusters and open a PR (pending user confirmation).
