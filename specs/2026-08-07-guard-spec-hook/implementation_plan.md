# Implementation Plan: Guard Spec PreToolUse Hook

- **Date**: 2026-08-07
- **Status**: Implemented
- **Slug**: `guard-spec-hook`

## Proposed Changes

### 1. Hook Script (`scripts/guard-spec.mjs`)
- Implement `isRootSpecPath(targetPath, cwd)` to test if a target resolves to root `spec.md` or `implementation_plan.md`.
- Implement `isRootSpecBashCommand(segment, cwd)` to parse bash redirection (`>`, `>>`) and commands (`touch`, `cp`, `mv`).
- Implement `decide(toolName, toolInput, cwd)` to return `{ blocked: true, reason }` or `{ blocked: false }`.
- Main entry point reads JSON payload from `stdin` and writes `hookSpecificOutput` with `permissionDecision: 'deny'` on policy violation.

### 2. Hook Registration (`hooks/hooks.json`)
- Add `guard-spec.mjs` invocation under `PreToolUse` for `Bash`, `Write`, and `Edit` matchers.

### 3. Verification Suite (`tests/guard-spec.test.mjs`)
- Unit tests verifying path matching, bash parsing, tool decision outputs, and `specs/` exemptions.

## Verification Plan

Run `node --test` to execute all tests.
