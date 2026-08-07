# Specification: Import Relevant Specs from Original Chōwa Repository

- **Date**: 2026-08-07
- **Status**: Implemented
- **Slug**: `import-chowa-specs`

## Problem Statement

The `chowa-skill` repository was created as a sibling pure-skill variant of Chōwa. However, `chowa-skill` lacks the historical specification audit trail for the features and conventions it inherited from the original Chōwa repository (`franprince/chōwa`), such as plugin distribution, cross-repo skill source-of-truth, delegation, and opt-in detection.

## Goals

1. Import all relevant historical spec directories from `/home/fran/Documentos/repos/chōwa/specs/` into `specs/` in `chowa-skill`.
2. Update `specs/INDEX.md` in `chowa-skill` to include imported historical specs alongside current local specs in chronological order.
3. Preserve original spec files, dates, and status values without modifications.

## Non-Goals

- Importing CLI engine-only specs that are irrelevant to `chowa-skill` (e.g. CLI internal session ledger / quota resume daemon specs).

## Relevant Specs to Import

- `2026-08-01-plugin-distribution`
- `2026-08-01-portable-global-skill-sync`
- `2026-08-01-pr-type-templates`
- `2026-08-01-routing-config-wiring`
- `2026-08-02-widen-project-opt-in-detection`
- `2026-08-02-mechanical-task-model-delegation`
- `2026-08-04-cross-repo-skill-source-of-truth`
- `2026-08-06-reverse-engineering-skill`

## Acceptance Criteria

- Specified directories copied to `specs/` under `chowa-skill`.
- `specs/INDEX.md` reflects all imported specs and locally created specs sorted chronologically.
- `node --test` passes cleanly.
