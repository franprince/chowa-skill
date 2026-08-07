# Implementation Plan: Import Relevant Specs from Original Chōwa Repository

- **Date**: 2026-08-07
- **Status**: Implemented
- **Slug**: `import-chowa-specs`

## Proposed Changes

### 1. Copy Spec Directories
Copy the following directories from `/home/fran/Documentos/repos/chōwa/specs/` to `specs/`:
- `2026-08-01-plugin-distribution`
- `2026-08-01-portable-global-skill-sync`
- `2026-08-01-pr-type-templates`
- `2026-08-01-routing-config-wiring`
- `2026-08-02-widen-project-opt-in-detection`
- `2026-08-02-mechanical-task-model-delegation`
- `2026-08-04-cross-repo-skill-source-of-truth`
- `2026-08-06-reverse-engineering-skill`

### 2. Update Spec Index (`specs/INDEX.md`)
Merge historical spec index entries into `specs/INDEX.md` alongside current local specs (`guard-spec-hook`, `backlog-creation-step`, `import-chowa-specs`), ordered chronologically.

## Verification Plan

- Run `node --test` to ensure test suite passes.
- Verify file existence under `specs/`.
