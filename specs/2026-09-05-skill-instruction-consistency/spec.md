# Specification: Skill instruction consistency and context use

- **Date**: 2026-09-05
- **Status**: Done
- **Slug**: `skill-instruction-consistency`

## Problem Statement

The skill's workflow has accumulated conflicting activation conditions,
repeated approval requests, host-specific tool assumptions, and substantial
optional guidance in its entrypoint. The generated file is in sync: the
problems originate in the shared template and generator-owned prose.

## Goals

1. Align documented persistent opt-in signals with the hooks and distinguish
   conversation authorization from the signals available to a stateless hook.
2. Define workflow entry points and approval checkpoints that preserve the
   user's requested scope and reuse existing authorization.
3. Make visual proof explicitly opt-in, give optional procedures clear
   triggers, and resolve lean-roadmap metadata requirements.
4. Support the current host's available capabilities and resolve bundled
   scripts independently of the target project's working directory.
5. Standardize phrasing, PR footer placement, delegation verification, and
   branch-neutral guard feedback.
6. Reduce the entrypoint's context cost through generated, on-demand
   references. Template distribution is now superseded by
   [Portable agent skill](../2026-09-05-portable-agent-skill/spec.md).

## Non-Goals

- Changing hook detection or protected-branch enforcement policy.
- Installing hooks, synchronizing personal installations, publishing a
  release.
- Adding a new runtime configuration engine or model router.

## Acceptance Criteria

- A config-only repository has the same documented opt-in status as it has
  in `isOptedIn`; conversation-only activation has an explicit persistence
  boundary.
- Existing approval of implementation or PR creation does not cause another
  approval request for the same action and scope.
- UI file extensions alone do not enable experimental visual proof.
- Missing optional host tools have a practical fallback; script examples
  use a resolved installation root and retain the target project as CWD.
- Lean roadmap output uses available index metadata; rich reads have a
  stated content budget.
- The skill and mechanical agent retain primary-agent review responsibility.
- Generated reference files and their links are validated for presence and
  freshness.
- The core entrypoint is at most 12,000 characters (approximately 3,000
  tokens at characters / 4), retaining essential workflow constraints.
- Existing repository quality gates and targeted generation checks pass.

## Authorization

The user requested the assessment's improvements to be planned and
implemented in the same instruction. This authorizes the specification,
plan, tasks, and implementation within the scope above without another
stage-approval round trip.

The user subsequently requested a PR, authorizing the local commit, topic
branch push, and PR creation against `main`.

## Implementation State

Implemented, verified, and committed on `refactor/skill-instructions` for PR
review. See the implementation plan for verification results.
