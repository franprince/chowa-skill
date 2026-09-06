# Spec Index

Chōwa Skill's spec → plan → execute pipeline persists every iteration's `spec.md` and `implementation_plan.md` under a dated, slugged directory here instead of loose files at the repo root. Entries retain stable links; superseded records identify their replacement and preserve earlier detail in Git history.

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
| 2026-08-01 | [routing-config-wiring](2026-08-01-routing-config-wiring/spec.md) | Superseded by [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Routing configuration (retired) |
| 2026-08-01 | [portable-global-skill-sync](2026-08-01-portable-global-skill-sync/spec.md) | Superseded by [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Portable skill distribution |
| 2026-08-01 | [pr-type-templates](2026-08-01-pr-type-templates/spec.md) | Superseded by [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Pull request descriptions |
| 2026-08-01 | [plugin-distribution](2026-08-01-plugin-distribution/spec.md) | Superseded by [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Optional plugin distribution |
| 2026-08-02 | [widen-project-opt-in-detection](2026-08-02-widen-project-opt-in-detection/spec.md) | Superseded by [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Project opt-in detection |
| 2026-08-02 | [mechanical-task-model-delegation](2026-08-02-mechanical-task-model-delegation/spec.md) | Superseded by [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Mechanical task delegation |
| 2026-08-04 | [cross-repo-skill-source-of-truth](2026-08-04-cross-repo-skill-source-of-truth/spec.md) | Superseded by [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Workflow source of truth |
| 2026-08-06 | [reverse-engineering-skill](2026-08-06-reverse-engineering-skill/spec.md) | Done | Codebase audit and architecture discovery skill |
| 2026-08-07 | [guard-spec-hook](2026-08-07-guard-spec-hook/spec.md) | Done | Enforce per-feature spec paths via `guard-spec.mjs` PreToolUse hook |
| 2026-08-07 | [backlog-creation-step](2026-08-07-backlog-creation-step/spec.md) | Done | Add backlog creation step (`specs/BACKLOG.md`) for complex tasks |
| 2026-08-07 | [import-chowa-specs](2026-08-07-import-chowa-specs/spec.md) | Superseded by [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Historical specification records |
| 2026-08-07 | [standardize-spec-statuses](2026-08-07-standardize-spec-statuses/spec.md) | Done | Standardize spec status vocabulary and normalize all completed specs |
| 2026-08-07 | [always-on-and-ste100-mode](2026-08-07-always-on-and-ste100-mode/spec.md) | Done | Always-on turn 1 session presence and ASD-STE100 Simplified Technical English mode |
| 2026-08-08 | [visual-proof-for-changes](2026-08-08-visual-proof-for-changes/spec.md) | Draft | ⚠️ Experimental — Mandatory visual proof section in Pull Requests for UI and styling changes |
| 2026-08-09 | [automated-versioning](2026-08-09-automated-versioning/spec.md) | Done | Fully automatic Conventional-Commits-driven version bumping for `.claude-plugin/plugin.json` on merge to `main` |
| 2026-08-09 | [roadmap-visualization](2026-08-09-roadmap-visualization/spec.md) | Done | On-demand, presentation-quality Artifact timeline of a project's spec history |
| 2026-08-13 | [speckit-inspired-stages](2026-08-13-speckit-inspired-stages/spec.md) | Draft | Constitution, Clarify, Tasks, and Analyze stages added natively to the spec pipeline (spec-kit inspired, no CLI adopted) |
| 2026-08-14 | [storybook-visual-proof-tool](2026-08-14-storybook-visual-proof-tool/spec.md) | Draft | Automated Before & After Storybook screenshot comparison tool for PR visual proof |
| 2026-08-17 | [cross-harness-hook-guards](2026-08-17-cross-harness-hook-guards/spec.md) | Done | Fix the eight hook-layer audit findings; guards now run on Claude Code, Gemini CLI, and Codex |
| 2026-09-05 | [skill-instruction-consistency](2026-09-05-skill-instruction-consistency/spec.md) | Done | Align workflow conditions and approval semantics; extract optional procedures to reduce entrypoint context |
| 2026-09-05 | [portable-agent-skill](2026-09-05-portable-agent-skill/spec.md) | Done | Self-contained skill distribution and native Claude, Codex, and Gemini integration |
