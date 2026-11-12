# Specification: Guard Spec PreToolUse Hook

- **Date**: 2026-08-07
- **Status**: Done
- **Slug**: `guard-spec-hook`

## Problem Statement

AI coding agents often overwrite single root-level `spec.md` or `implementation_plan.md` files or ignore spec-driven workflows entirely. Prompt-only rules fail when starting new terminal sessions because the agent context is reset.

## Goals

1. Mechanically intercept tool executions that attempt to create or edit loose root-level spec files (`spec.md`, `implementation_plan.md`). A root-level spec file that git already tracks is not loose (see Amendments).
2. Require spec files to live inside per-feature directories (`specs/<YYYY-MM-DD>-<slug>/`) and be indexed in `specs/INDEX.md`.
3. Support ongoing spec iteration within `specs/<YYYY-MM-DD>-<slug>/` directories without blocking legitimate edits.

## Non-Goals

- Blocking source code edits across non-spec tasks when `specs/` layout is not active in unrelated projects.
- Replacing project-level lint/test scripts.

## Behavioral Requirements

- **File Tool Interception**: Block `Write`, `Edit`, or file modification tools targeting an untracked `spec.md` or `implementation_plan.md` at root level.
- **Bash Output Interception**: Block bash commands redirecting (`>`, `>>`) or manipulating (`touch`, `cp`, `mv`) untracked root spec files.
- **Tracked File Exemption**: Allow every write to a root-level spec file that git already tracks, including a whole-file overwrite. A file is tracked when it is in the index of the repository, so a staged file qualifies. The path is compared as written. If git cannot answer (no repository, no `git`, a timeout), the file counts as untracked and the write stays blocked.
- **Per-Feature Spec Exemption**: Explicitly allow edits to `specs/<YYYY-MM-DD>-<slug>/*` and `specs/INDEX.md`.

## Acceptance Criteria

- Unit test suite covers root spec path detection, bash command parsing, tool decision logic, and feature folder exemptions.
- PreToolUse hook registered in `hooks/hooks.json`.
- Tests cover the tracked-file exemption on file tools, `apply_patch` and shell writes, and confirm that an untracked root spec file in the same repository stays blocked.

## Amendments

- **2026-11-12 — Tracked root spec files are exempt.** The guard denied edits to a root-level `SPEC.md` that a project had already committed as its own document, and advised moving it into a feature directory, which was wrong for that file. The guard now blocks only root spec files that git does not track. Known cost: a tracked root `spec.md` left from the single-file habit described in the Problem Statement can be overwritten again. Goal 1 and the Behavioral Requirements above carry the amended wording; the original text is in Git history.
