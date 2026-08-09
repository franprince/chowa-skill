# Specification: Visual Proof Requirements in Pull Requests for Feature & Style Changes

- **Date**: 2026-08-08
- **Status**: Draft
- **Slug**: `visual-proof-for-changes`
- **Stability**: ⚠️ Experimental — opt-in, not yet stabilized. May change or
  be reverted based on real-world PR usage before it's treated as a
  standing workflow rule.

## Problem Statement

When opening or updating Pull Requests for UI features, CSS/styling fixes, layout modifications, or visual component changes in a Chōwa project, PR descriptions often lack visual evidence.

Without mandatory visual proof in PR descriptions:
1. Reviewers must manually check out the branch and run the application to inspect visual changes.
2. Design regressions or UI defects are easily missed during code-only PR reviews.
3. Historical PRs lack visual records of what changed in the UI over time.

## Goals

1. **Mandatory PR Visual Proof Section**: Require every Pull Request description generated or created via Chōwa (`gh pr create` / `chowa pr`) to include a `### Visual Proof` section.
2. **Visual Evidence for UI/Style Changes**: When a PR includes visual or styling modifications (CSS, SCSS, UI components, HTML templates, assets), the author/agent MUST attach visual proof (e.g. before/after screenshots, Playwright browser snapshots, rendered UI mockups, or carousels) into the PR description.
3. **Explicit Non-Visual Exemption**: For PRs touching only backend code, CLI logic, tests, or non-visual files, the section must explicitly state `N/A (non-visual change)`.
4. **Update Chōwa Workflow Template & Skill**: Update `templates/chowa-workflow.md` and rebuild `skills/chowa-skill/SKILL.md` using `scripts/generate-skill.mjs`.

## Non-Goals

- Requiring manual screenshots for backend/non-visual PRs (handled by `N/A (non-visual change)`).
- Developing a standalone image hosting service (use markdown image links, relative paths, browser snapshots, or artifact carousels supported by GitHub/git platform).

## Specification Details

### 1. Visual Proof in PR Descriptions
In Section 7 (**PR Description Generation**) of the Chōwa workflow:
- The PR template structure MUST include:
  ```markdown
  ### Summary
  <concise description of changes>

  ### Visual Proof
  <!-- For UI/styling changes: attach before/after screenshots, carousels, or image links. For non-visual changes: state N/A (non-visual change) -->
  ![Visual Proof](<path-or-url>) 
  <!-- or carousels / before-after comparisons -->

  ### Verification
  <test & quality gate results>
  ```

### 2. UI/Style Change Trigger Criteria
Visual proof is required whenever a PR touches:
- Styling files (`*.css`, `*.scss`, `*.less`, Tailwind configs).
- UI/frontend component files (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.html`).
- Graphic assets, layout templates, or theme definitions.

### 3. Visual Proof Formats in PRs
- **Single Screenshot / Image**: `![Component Screenshot](<path-or-url>)`
- **Before / After Comparison**:
  | Before | After |
  |---|---|
  | ![Before](<url-1>) | ![After](<url-2>) |
- **Non-Visual Exemption**: `N/A (non-visual change)`

## Acceptance Criteria

1. `specs/2026-08-08-visual-proof-for-changes/spec.md` updated with PR-focused visual proof specification.
2. `templates/chowa-workflow.md` updated to include the `### Visual Proof` section in PR Description Generation.
3. `scripts/generate-skill.mjs` run to rebuild `skills/chowa-skill/SKILL.md`.
4. Unit tests (`tests/generate-skill.test.mjs`) updated and passing with `node --test`.
