# Tasks: Storybook Before/After Visual Proof Tool

- **Date**: 2026-08-14
- **Status**: Draft
- **Slug**: `storybook-visual-proof-tool`

1. [ ] Write `scripts/storybook-proof.mjs`'s pure functions:
   `resolveStoryFilesFromDiff`, `extractStoryIdsFromSource`,
   `classifyStories`, `buildComparisonTable`.
2. [ ] Write `scripts/storybook-proof.mjs`'s CLI entry point: arg
   parsing, preconditions, spec-directory resolution, diff-based story
   identification.
3. [ ] Implement the "Before" capture path: worktree creation, free-port
   allocation, `storybook dev` spawn + health poll, per-story Playwright
   screenshot with failure isolation, teardown.
4. [ ] Implement the "After" capture path (same as Before, no worktree).
5. [ ] Implement classification + Markdown rendering + snippet file
   output, plus `SIGINT`/`SIGTERM` teardown handlers.
6. [ ] Write `tests/storybook-proof.test.mjs` covering all four pure
   functions per the implementation plan's test list.
7. [ ] Edit `templates/chowa-workflow.md`: add the on-request Storybook
   Visual Proof `shared` block after PR Description Generation.
8. [ ] Run `node scripts/generate-skill.mjs` to regenerate
   `skills/chowa-skill/SKILL.md`.
9. [ ] Run `node --test tests/*.mjs` and `node scripts/generate-skill.mjs
   --check` — full suite green.
10. [ ] Commit in logical clusters and open a PR (pending user
    confirmation).
