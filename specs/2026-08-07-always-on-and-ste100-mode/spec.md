# Specification: Global Always-On Enforcement & ASD-STE100 Simplified Technical English Mode

- **Date**: 2026-08-07
- **Status**: Done
- **Slug**: `always-on-and-ste100-mode`

## Problem Statement

1. **Always-On Prompt Presence**: While `~/.chowa-skill/preferences.json` supports `{"alwaysOn": true}`, fresh agent conversations may not immediately recognize or execute Chōwa workflow rules on turn 1 unless explicitly primed by the skill description and plugin instruction hooks.
2. **ASD-STE100 Mode**: Technical documentation, specifications, implementation plans, and PR descriptions often suffer from overly complex, ambiguous, or verbose natural language. Downstream technical teams and international contributors benefit from ASD-STE100 (Simplified Technical English) rules (controlled vocabulary, max sentence lengths, active voice, imperative instructions).

## Goals

1. **Always-On Guaranteed Active**: Update skill frontmatter and plugin configuration so that when `alwaysOn: true` is set in `~/.chowa-skill/preferences.json`, Chōwa's rules automatically activate at session start on turn 1 for every project.
2. **ASD-STE100 Mode**: Introduce an optional `ste100` mode toggle (`ste100: true` in `preferences.json` or `chowa.config.js`). When enabled:
   - All conversation responses output by the AI agent to the user MUST follow ASD-STE100 Simplified Technical English guidelines:
     - Active voice and imperative verbs.
     - Short sentences (max 20 words for instructions, max 25 words for descriptions).
     - Single explicit meaning per word, avoiding passive voice and idioms.
     - One instruction per sentence.

## Non-Goals

- Replacing programming language syntax (code syntax remains standard TypeScript/JavaScript/etc.; STE100 applies to written English text, docs, specs, plans, comments, and PR descriptions).

## Specification Details

### 1. Always-On Session Activation
- Ensure `SKILL.md` frontmatter `description` highlights automatic activation when `alwaysOn: true` is present in `~/.chowa-skill/preferences.json`.
- Add automatic verification in Step 0 so the agent checks `~/.chowa-skill/preferences.json` at the start of every session.

### 2. ASD-STE100 Mode Specification
- **Preferences Configuration**:
  ```json
  {
    "alwaysOn": true,
    "ste100": true
  }
  ```
- **Project Config**:
  ```js
  module.exports = {
    ste100: true
  };
  ```
- **STE100 Writing Rules**:
  - **Sentence Length**: Maximum 20 words for procedural/action steps, 25 words for descriptive statements.
  - **Voice & Tone**: Active voice only (e.g., "Write the file to `specs/`" instead of "The file should be written to `specs/`").
  - **Clarity**: Use clear, approved technical verbs (e.g., `create`, `remove`, `update`, `run`, `check`).
  - **Structure**: One instruction per sentence, sequentially numbered.

## Acceptance Criteria

1. `templates/chowa-workflow.md` updated with Step 0 Always-On presence rule and Section for ASD-STE100 Simplified Technical English Mode.
2. `scripts/generate-skill.mjs` executed to generate updated `skills/chowa-skill/SKILL.md`.
3. Unit tests added verifying preference parsing and STE100 mode activation.
4. `node --test` passes cleanly.
