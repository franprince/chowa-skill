# Specification: Skill token efficiency

- **Date**: 2026-10-17
- **Status**: Done
- **Slug**: `skill-token-efficiency`

## Problem Statement

The entrypoint loads whenever the skill activates, and its frontmatter
description loads in every session. Both repeated rules that the on-demand
references also stated, and several references restated rules the entrypoint
already guarantees. The generator also numbered entrypoint headings, which
added characters and no meaning.

## Goals

1. Cut entrypoint and reference size without dropping a workflow constraint.
2. State each rule once, where it is loaded when needed: global authorization
   and activation rules in the entrypoint, procedure detail in its reference.
3. Make the description lead with when the skill applies.
4. Let the mechanical agent create files, which scaffolding requires.
5. Lock in the reduction with a tighter entrypoint budget.

## Non-Goals

- Splitting the skill into separately installed skills; see
  [Optional spec refinement](../2026-09-05-optional-spec-refinement/spec.md).
- Changing hook behavior or the release process.

## Acceptance Criteria

- The entrypoint drops from 6,750 to at most 5,250 characters; the test budget
  becomes 5,500 so later changes have headroom without undoing the cut.
- Every removed sentence is either restated where it is loaded when needed or
  is implementation detail already recorded in code.
- Existing authorization still prevents repeated spec and plan approval
  requests, and delegation still requires authorization.
- Outside opt-in, Chōwa defaults such as its PR footer are not applied.
- The mechanical agent lists `Write` among its tools.
- `node --test` and `node scripts/generate-skill.mjs --check` pass.

## Result

Entrypoint 6,750 → 5,185 characters (−23%); references 21,380 → 19,312
(−10%), measured against `main` after the host-capability and router changes. `delegation.md` and `roadmap.md` were left unchanged: they are already
tight and load only on demand.
