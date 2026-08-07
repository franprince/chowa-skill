# Specification: Guard Spec PreToolUse Hook

- **Date**: 2026-08-07
- **Status**: Implemented
- **Slug**: `guard-spec-hook`

## Problem Statement

AI coding agents often overwrite single root-level `spec.md` or `implementation_plan.md` files or ignore spec-driven workflows entirely. Prompt-only rules fail when starting new terminal sessions because the agent context is reset.

## Goals

1. Mechanically intercept tool executions that attempt to create or edit loose root-level spec files (`spec.md`, `implementation_plan.md`).
2. Require spec files to live inside per-feature directories (`specs/<YYYY-MM-DD>-<slug>/`) and be indexed in `specs/INDEX.md`.
3. Support ongoing spec iteration within `specs/<YYYY-MM-DD>-<slug>/` directories without blocking legitimate edits.

## Non-Goals

- Blocking source code edits across non-spec tasks when `specs/` layout is not active in unrelated projects.
- Replacing project-level lint/test scripts.

## Behavioral Requirements

- **File Tool Interception**: Block `Write`, `Edit`, or file modification tools targeting `spec.md` or `implementation_plan.md` at root level.
- **Bash Output Interception**: Block bash commands redirecting (`>`, `>>`) or manipulating (`touch`, `cp`, `mv`) root spec files.
- **Per-Feature Spec Exemption**: Explicitly allow edits to `specs/<YYYY-MM-DD>-<slug>/*` and `specs/INDEX.md`.

## Acceptance Criteria

- Unit test suite covers root spec path detection, bash command parsing, tool decision logic, and feature folder exemptions.
- PreToolUse hook registered in `hooks/hooks.json`.
