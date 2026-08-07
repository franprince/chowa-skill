# Implementation Plan: Standardize Spec Status Vocabulary

- **Date**: 2026-08-07
- **Status**: Done
- **Slug**: `standardize-spec-statuses`

## Proposed Changes

### 1. Spec Index (`specs/INDEX.md`)
- Add the official status vocabulary section matching Chōwa's convention.
- Update table entries for `guard-spec-hook`, `backlog-creation-step`, `import-chowa-specs`, and `standardize-spec-statuses` from `Implemented` to `Done`.

### 2. Individual Spec & Implementation Plan Files
- Update status headers in:
  - `specs/2026-08-07-guard-spec-hook/spec.md` & `implementation_plan.md`
  - `specs/2026-08-07-backlog-creation-step/spec.md` & `implementation_plan.md`
  - `specs/2026-08-07-import-chowa-specs/spec.md` & `implementation_plan.md`
  - `specs/2026-08-07-standardize-spec-statuses/spec.md` & `implementation_plan.md`

## Verification Plan

- Check `specs/INDEX.md` formatting and status values.
- Run `node --test` to ensure test suite passes.
