# Spec Index

Chōwa's spec → plan → execute pipeline persists every iteration's `spec.md` and `implementation_plan.md` under a dated, slugged directory here instead of loose files at the repo root. Every entry below is a permanent record of feature specifications and architecture plans.

## Status Vocabulary

- `Draft`: Initial proposal under discussion.
- `Approved`: Reviewed and accepted, ready for implementation.
- `In Progress`: Implementation currently underway.
- `Done`: Implemented, tested, verified, and committed.
- `Dismissed`: Decided against with rationale recorded.
- `Superseded by <link>`: Replaced by a newer specification.

## Specs

| Date | Slug | Status | Summary |
|---|---|---|---|
| 2026-08-01 | [routing-config-wiring](2026-08-01-routing-config-wiring/spec.md) | Done | `chowa.config.ts` loading and router fallbacks |
| 2026-08-01 | [portable-global-skill-sync](2026-08-01-portable-global-skill-sync/spec.md) | Done | Multi-harness portable skill sync |
| 2026-08-01 | [pr-type-templates](2026-08-01-pr-type-templates/spec.md) | Done | Branch-prefix PR-type templates and release flow descriptions |
| 2026-08-01 | [plugin-distribution](2026-08-01-plugin-distribution/spec.md) | Done | Marketplace & Claude Code plugin distribution |
| 2026-08-02 | [widen-project-opt-in-detection](2026-08-02-widen-project-opt-in-detection/spec.md) | Done | Step 0 opt-in signals, alwaysOn preference, and onboarding |
| 2026-08-02 | [mechanical-task-model-delegation](2026-08-02-mechanical-task-model-delegation/spec.md) | Done | Mechanical sub-task model delegation subagent |
| 2026-08-04 | [cross-repo-skill-source-of-truth](2026-08-04-cross-repo-skill-source-of-truth/spec.md) | Done | Shared workflow template source of truth |
| 2026-08-06 | [reverse-engineering-skill](2026-08-06-reverse-engineering-skill/spec.md) | Done | Codebase audit and architecture discovery skill |
| 2026-08-07 | [guard-spec-hook](2026-08-07-guard-spec-hook/spec.md) | Done | Enforce per-feature spec paths via `guard-spec.mjs` PreToolUse hook |
| 2026-08-07 | [backlog-creation-step](2026-08-07-backlog-creation-step/spec.md) | Done | Add backlog creation step (`specs/BACKLOG.md`) for complex tasks |
| 2026-08-07 | [import-chowa-specs](2026-08-07-import-chowa-specs/spec.md) | Done | Import relevant historical specs from original Chōwa repository |
| 2026-08-07 | [standardize-spec-statuses](2026-08-07-standardize-spec-statuses/spec.md) | Done | Standardize spec status vocabulary and normalize all completed specs |
| 2026-08-07 | [always-on-and-ste100-mode](2026-08-07-always-on-and-ste100-mode/spec.md) | Done | Always-on turn 1 session presence and ASD-STE100 Simplified Technical English mode |
| 2026-08-08 | [visual-proof-for-changes](2026-08-08-visual-proof-for-changes/spec.md) | Draft | ⚠️ Experimental — Mandatory visual proof section in Pull Requests for UI and styling changes |
| 2026-08-09 | [automated-versioning](2026-08-09-automated-versioning/spec.md) | Done | Fully automatic Conventional-Commits-driven version bumping for `.claude-plugin/plugin.json` on merge to `main` |
| 2026-08-09 | [roadmap-visualization](2026-08-09-roadmap-visualization/spec.md) | Done | On-demand, presentation-quality Artifact timeline of a project's spec history |
| 2026-08-13 | [speckit-inspired-stages](2026-08-13-speckit-inspired-stages/spec.md) | Draft | Constitution, Clarify, Tasks, and Analyze stages added natively to the spec pipeline (spec-kit inspired, no CLI adopted) |
| 2026-08-14 | [storybook-visual-proof-tool](2026-08-14-storybook-visual-proof-tool/spec.md) | Draft | Automated Before & After Storybook screenshot comparison tool for PR visual proof |
