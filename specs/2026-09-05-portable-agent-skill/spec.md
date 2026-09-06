# Portable agent skill

Status: Done

## Problem and authorization

The user requested a standalone skill for Claude Code, Codex, and Gemini CLI,
with obsolete product dependencies and references removed. This request
authorizes planning and implementation of that scope.

## Acceptance criteria

- One workflow source describes the skill and uses each host's available tools.
- Copying the complete skill directory includes all runtime helpers and references.
- Installation instructions use each host's native skill discovery locations.
- Hook adapters handle documented Claude, Codex, and Gemini payloads and decisions.
- Hook installation preserves other configuration and safely handles quoted paths.
- Public metadata and repository documentation describe only this skill; obsolete
  historical requirements are explicitly superseded rather than presented as current.
- Generated artifacts stay synchronized, the core stays under 12,000 characters,
  and regression checks exercise helpers from an isolated skill installation.

## Boundaries

Keep existing optional hook and Storybook behavior. Do not install user-wide
configuration, add model-provider services, or claim live host tests that were
not performed. Native delegation remains optional with inline execution available.
