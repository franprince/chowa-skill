# Optional spec refinement and modular workflow

Status: Done

## Problem and scope

The user asked whether a thin router should orchestrate separate skills, and
requested an optional grilling step to produce more detailed specs before
planning. The request authorizes adding that capability to the current work.

## Decision

Keep one portable skill directory. Use the entrypoint for activation,
authorization, routing, and host-independent invariants. Load substantive
procedures from local references. Independent skills are appropriate if a
procedure later needs separate discovery and use outside this workflow;
they are not required merely to defer loading instructions.

This avoids introducing skill-to-skill invocation or installation dependencies
across Claude Code, Codex, and Gemini CLI. It does not promise that a host
unloads instructions already read earlier in a conversation.

## Acceptance criteria

- The entrypoint routes to specification, delivery, delegation, and existing
  optional procedures without loading unrelated instructions.
- Once a meaningful draft exists, offer a spec roast once before the first
  planning transition. An explicit request opts in; an explicit skip opts out.
  Wait for a response to an offered choice; silence is not consent or decline.
- Record pending, active, declined, completed, or stopped state in the feature
  spec. Resumption never repeats an answered offer or resumes a stopped roast.
- Accepted refinement challenges the spec, using small rounds of independent
  questions, recommended answers, and repository evidence. It is candid about
  the work without personal ridicule.
- Focus on material requirements and testable acceptance criteria. Research
  facts using available tools; ask the user for decisions and unavailable context.
- Update the spec with answers, explicit assumptions, deferred scope, and open
  blockers. Stop on request or when sufficient; confirm the resulting spec
  before proceeding, reusing confirmation already provided by the user.
- Declining optional refinement preserves normal necessary clarification and
  existing authorization. Never offer during unrelated commits, PRs, trivial
  edits, or resumption of an already approved implementation plan.
- No dependency on a separately installed grilling skill, named subagent,
  model, or host-specific question API. Generated links resolve and the core
  context cost decreases.
