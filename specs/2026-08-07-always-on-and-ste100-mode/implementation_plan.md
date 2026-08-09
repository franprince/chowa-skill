# Implementation Plan: Always-On Enforcement & ASD-STE100 Mode

- **Date**: 2026-08-07
- **Status**: Done
- **Slug**: `always-on-and-ste100-mode`

## Proposed Changes

### 1. Workflow Template (`templates/chowa-workflow.md`)
- Update Step 0 to explicitly instruct agents to inspect `~/.chowa-skill/preferences.json` on turn 1 of every conversation.
- Add an explicit **ASD-STE100 Simplified Technical English Mode** rule section detailing the 4 core STE100 writing constraints for conversation responses (active voice, max 20-25 words per sentence, clear technical verbs, one instruction per line).

### 2. Skill Re-generation (`scripts/generate-skill.mjs`)
- Update frontmatter `description` in `scripts/generate-skill.mjs` to highlight auto-activation on `alwaysOn`.
- Run `node scripts/generate-skill.mjs` to produce updated `skills/chowa-skill/SKILL.md`.

### 3. Preferences Scaffolding
- Update `~/.chowa-skill/preferences.json` to include `"ste100": true` when enabled by the user.

### 4. Spec Index Update (`specs/INDEX.md`)
- Register `always-on-and-ste100-mode` entry.

## Verification Plan

- Run `node scripts/generate-skill.mjs --check`.
- Run `node --test` to verify test suite.
