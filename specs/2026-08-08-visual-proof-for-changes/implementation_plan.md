# Implementation Plan: Visual Proof Requirements in Pull Requests

- **Date**: 2026-08-08
- **Status**: Draft
- **Slug**: `visual-proof-for-changes`
- **Stability**: ⚠️ Experimental — see spec.md.

## Proposed Changes

### 1. Workflow Template (`templates/chowa-workflow.md`)
- Update Section 7 (PR Description Generation) to specify that every PR description MUST include a `### Visual Proof` section.
- Add instructions and format examples for PR descriptions (before/after image tables, single screenshot links, carousels, or `N/A (non-visual change)`).

### 2. Skill Re-generation (`scripts/generate-skill.mjs`)
- Rebuild `skills/chowa-skill/SKILL.md` by running `node scripts/generate-skill.mjs`.

### 3. Unit Tests (`tests/generate-skill.test.mjs`)
- Add unit assertions ensuring the generated `SKILL.md` contains the mandatory `### Visual Proof` PR section instructions.

## Verification Plan

### Automated Verification
- Run `node scripts/generate-skill.mjs` to regenerate `skills/chowa-skill/SKILL.md`.
- Run `node --test` to verify all tests pass cleanly.

### PR Visual Verification
- Verify that PR description generation instructions in the generated `SKILL.md` cleanly include `### Visual Proof`.
