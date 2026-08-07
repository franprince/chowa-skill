# Specification: Standardize Spec Status Vocabulary

- **Date**: 2026-08-07
- **Status**: Done
- **Slug**: `standardize-spec-statuses`

## Problem Statement

Chōwa's spec index uses a standardized status taxonomy: `Draft`, `Approved`, `In Progress`, `Done`, `Dismissed`, and `Superseded`. Recently created local specs used `Implemented` instead of the canonical status `Done`, causing status inconsistency in `specs/INDEX.md`.

## Goals

1. Standardize all completed specs in `specs/INDEX.md` and their respective `spec.md` / `implementation_plan.md` files to use `Done`.
2. Document the official status vocabulary in `specs/INDEX.md`.

## Standard Status Vocabulary

- `Draft`: Initial proposal under discussion.
- `Approved`: Reviewed and accepted, ready for implementation plan or coding.
- `In Progress`: Implementation currently underway.
- `Done`: Implemented, tested, verified, and committed.
- `Dismissed`: Decided against with reason noted.
- `Superseded by <link>`: Replaced by a newer specification.

## Acceptance Criteria

- All local `Implemented` statuses changed to `Done` across `specs/INDEX.md`, `spec.md`, and `implementation_plan.md` files.
- Official status vocabulary section added to `specs/INDEX.md`.
