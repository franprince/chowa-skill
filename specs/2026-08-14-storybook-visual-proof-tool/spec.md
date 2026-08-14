# Specification: Storybook Before/After Visual Proof Tool

- **Date**: 2026-08-14
- **Status**: Draft
- **Slug**: `storybook-visual-proof-tool`
- **Stability**: Draft (requires approval)

## Problem Statement

The experimental "Visual Proof" requirement in Chōwa mandates attaching visual evidence of UI and styling changes in Pull Requests. In code reviews, reviewers benefit most from seeing a direct **Before vs. After** comparison of modified components to quickly evaluate the impact of a visual change.

However, capturing before-and-after screenshots manually requires checking out the base branch, running Storybook, taking screenshots, checking out the feature branch, running Storybook again, taking screenshots, and assembling a comparison table. We need an automated tool that takes care of the entire lifecycle: checking out the base branch via a temporary `git worktree`, spinning up Storybook, taking "Before" screenshots with Playwright, spinning up Storybook on the feature branch, taking "After" screenshots, and formatting them into a side-by-side Markdown comparison table.

## Goals

1. **Automated Before/After Capture**: A standalone command/script `scripts/storybook-proof.mjs` that captures both "Before" and "After" states of modified components.
2. **Git Worktree Isolation for Base State**: Use a temporary `git worktree` checked out at the base branch (e.g. `main` or base PR ref) to run Storybook and capture "Before" snapshots without dirtying the current working directory.
3. **Git Diff Story Matching**: Detect modified UI components using `git diff` against the base ref, find their corresponding Storybook stories, and snapshot only affected components.
4. **New/Removed Component Handling**: If a component is newly added in the current branch, cleanly mark the "Before" column as `N/A (New Component)` and render only the "After" screenshot. If a component existed on the base branch but was deleted in the current branch, mark the "After" column as `N/A (Removed)` and render only the "Before" screenshot.
5. **Playwright Screenshot Engine**: Headless browser capture of story iframe URLs (`/iframe.html?id=<story-id>&viewMode=story`) on dynamic/free ports.
6. **Side-by-Side PR Markdown Output**: Generate a ready-to-use Markdown comparison table for the PR's `### Visual Proof` section:
   ```markdown
   | Component / Story | Before | After |
   |---|---|---|
   | `Button` / `Primary` | ![Before](specs/<slug>/proof/button-primary-before.png) | ![After](specs/<slug>/proof/button-primary-after.png) |
   | `NewModal` / `Default` | *N/A (New Component)* | ![After](specs/<slug>/proof/newmodal-default-after.png) |
   | `OldBanner` / `Default` | ![Before](specs/<slug>/proof/oldbanner-default-before.png) | *N/A (Removed)* |
   ```
7. **Clean Teardown**: Gracefully shut down all spawned Storybook processes and remove temporary worktrees upon completion or interruption.

## Non-Goals

- Full layout / end-to-end page visual regression testing (focused specifically on Storybook components).
- External image hosting dependencies (assets stored directly under `specs/<slug>/proof/`).
- Pixel-by-pixel image diff highlighting (side-by-side visual comparison is the target).

## Specification Details

### 1. Execution Flow
1. **Identify Target Stories**:
   - Run `git diff --name-only <base-branch>...HEAD` to find modified/added component and story files.
   - Map files to story identifiers.
2. **Capture 'Before' Snapshots**:
   - Create a temporary git worktree at `<base-branch>` (e.g. in `.git/chowa-worktrees/proof-base`).
   - Launch Storybook on a free port in that worktree.
   - For each target story that exists in the base state, capture a screenshot via Playwright -> `specs/<slug>/proof/<story-id>-before.png`.
   - Tear down Storybook and remove the temporary worktree.
3. **Capture 'After' Snapshots**:
   - Launch Storybook in the current workspace on a free port.
   - Capture a screenshot for each target story -> `specs/<slug>/proof/<story-id>-after.png`.
   - Tear down Storybook.
4. **Generate Comparison Markdown**:
   - Output the Markdown table linking before and after images.
   - Print or save snippet for inclusion in `spec.md` or PR description.

### 2. CLI Options
- `--base <ref>`: Base branch/ref to compare against (defaults to `main` or detected upstream base).
- `--stories <ids>`: Comma-separated story IDs to snapshot manually (skipping git diff matching).
- `--all`: Capture all stories instead of diff-based filtering.
- `--port <number>`: Specific port override for Storybook.

## Acceptance Criteria

1. `scripts/storybook-proof.mjs` implements the full Before/After capture workflow with worktree management.
2. New stories (absent on the base branch) display `*N/A (New Component)*`; removed stories (absent on the current branch) display `*N/A (Removed)*`.
3. Unit/integration tests cover diff resolution, story matching, and table generation.
4. `templates/chowa-workflow.md` is updated and `skills/chowa-skill/SKILL.md` is regenerated.
