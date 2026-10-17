# Specification: Host capability verbs

- **Date**: 2026-10-17
- **Status**: Done
- **Slug**: `host-capability-verbs`

## Problem Statement

The skill runs on Claude Code, Codex, Gemini CLI, and Antigravity, but its
procedures named Claude Code tools (`AskUserQuestion`, `TaskCreate`, `Agent`)
and described other hosts only as "the host's question tool" or "native
delegation". An agent on another host had to guess the mapping, and nothing
recorded which tools exist where. The hook layer already normalizes tool names
across hosts in `scripts/lib/harness.mjs`; the instructions had no equivalent.

## Goals

1. Procedures name capabilities (`ask_user`, `track_tasks`, `delegate`,
   `run_shell`, `edit_files`), never host tools.
2. One on-demand reference defines each capability, its fallback, and the
   verified per-host tool names.
3. A missing tool never blocks the workflow; every capability has a fallback.
4. The entrypoint stays within its size budget.

## Non-Goals

- Per-host adapter files or runtime detection code.
- Recording tool names that could not be verified; unknown cells stay empty.
- Changing hook behavior.

## Acceptance Criteria

- `references/host-capabilities.md` is generated from the template and linked
  from the entrypoint's Host capabilities section.
- Pipeline, delegation, and spec-refinement procedures use capability names.
- Mappings note that Codex's `update_plan` is opt-in since Codex CLI 0.152.0.
- The entrypoint stays within its 5,500-character budget.
- `node --test` and `node scripts/generate-skill.mjs --check` pass.

## Inspiration

Adapted from pstack's capability verbs and host adapters, reduced to a single
reference table because this skill names only five capabilities.
