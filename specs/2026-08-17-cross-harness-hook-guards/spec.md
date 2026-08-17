# Specification: Cross-Harness Hook Guards

- **Date**: 2026-08-17
- **Status**: Done
- **Slug**: `cross-harness-hook-guards`

## Problem Statement

An audit of the hook layer (`guard-push.mjs`, `guard-spec.mjs`,
`hooks/hooks.json`) surfaced eight defects, two of them silent, plus a
scope gap: the guards only exist for Claude Code, while the workflow
itself is meant to be harness-neutral (the sibling `chowa` repo already
syncs a provider-neutral skill to Gemini).

Audit findings, in the order they were reported:

1. **`guard-spec.mjs` silently no-ops** when invoked through a symlink or
   from a path containing non-ASCII characters. Its direct-run check
   (`import.meta.url === \`file://${process.argv[1]}\``) is the exact
   comparison `guard-push.mjs` documents as broken and fixed with
   `isDirectRun()`. Verified: canonical path denies, symlinked path and
   non-ASCII path both exit 0 with no output — indistinguishable from
   "allowed". The same naive check exists in `generate-skill.mjs`,
   `bump-version.mjs`, and `storybook-proof.mjs`.
2. **No opt-in gate in the hook layer.** SKILL.md Step 0 classifies
   projects as opted-in / always-on / unrelated and defers to the
   project's own conventions for unrelated ones. The hooks fire
   unconditionally in every repository. A root-level `tasks.md` — a
   common file — becomes permanently unwritable in projects that never
   adopted the convention.
3. **`deny` leaves no override path.** Both guards emit
   `permissionDecision: "deny"`, which the user cannot approve past.
   `git push -u origin main` on a brand-new repository's first push is
   blocked with no escape hatch.
4. **Two bypasses in `guard-push`.** `git -C /repo push origin main` is
   allowed, because the `-C` branch sits after `if
   (token.startsWith('-')) continue;` and is unreachable, so `-C`'s value
   is read as the subcommand. `git push origin HEAD` while on `main` is
   allowed, because a present refspec skips the current-branch check and
   `HEAD` does not resolve to a branch name.
5. **The hook contract is untested.** All tests import `decide()`
   directly; nothing spawns a script, writes a payload to stdin, and
   asserts the emitted JSON — which is why finding 1 is invisible to CI.
6. **Dead generalization in `guard-spec`.** `decide()` reads `path`,
   `TargetFile`, `target_file`, and `AbsolutePath` for other harnesses'
   conventions, but the matcher list only covers `Bash|Write|Edit`, so
   those keys are never populated. `notebook_path` is absent, so
   `NotebookEdit` on `spec.md` returns `blocked: false`.
7. **`.agents/hooks.json` is documented but is not a real config path**
   for any harness (`templates/chowa-workflow.md`).
8. **Two Node processes spawn per Bash tool call**, because both guards
   are registered separately under the same matcher.

Minor: neither guard respects shell quoting. `echo "text > spec.md"` is
blocked (a false positive, which the fail-open doctrine calls the worse
failure), while `sed -i … spec.md` and `git mv notes.md spec.md` pass.

## Goals

1. **G1.** Fix findings 1–8 and the quoting defect.
2. **G2.** The guards run, and reach the same verdict, under Claude Code,
   Gemini CLI, and Codex (ChatGPT) — each harness's own event name, tool
   names, tool-input shape, and deny schema.
3. **G3.** An unrecognized harness still blocks, rather than failing open
   silently, using the exit-2 + stderr convention all three share.
4. **G4.** Ship ready-to-install configuration for all three harnesses,
   and a command that merges it into the user's config idempotently.
5. **G5.** Decision policy is deliberate per guard, not incidental:
   agent-correctable violations `deny` (the agent retries correctly);
   decisions that belong to the human `ask` where the harness supports
   it, `deny` where it does not.

## Non-Goals

- Not making the guards exhaustive against a determined bypass. The
  fail-open doctrine in `guard-push.mjs` stands: the prose rule is the
  backstop, and blocking legitimate work is the worse failure.
- Not implementing a full shell parser. Quote-awareness covers the
  realistic cases; `eval`, command substitution, and base64-encoded
  payloads remain out of scope.
- Not supporting harness events beyond the pre-tool-use family
  (`PreToolUse` / `BeforeTool`).
- Not auto-installing hooks into Gemini or Codex configs on session
  start. Writing to a user's global config is an explicit action, per
  the `portable-global-skill-sync` precedent.

## Behavioral Requirements

### Harness dialects

| Dialect | Detected by | Deny schema | `ask` |
|---|---|---|---|
| `claude` | `hook_event_name: "PreToolUse"` | `hookSpecificOutput.permissionDecision` | yes |
| `codex` | `PreToolUse` + `turn_id`/`tool_use_id` present | `hookSpecificOutput.permissionDecision` | no |
| `gemini` | `hook_event_name: "BeforeTool"` | `{"decision":"deny","reason"}` | no |
| `generic` | anything else | exit 2, reason on stderr | no |

Normalization maps each harness's tool vocabulary onto two kinds:

- **shell** — `Bash` (Claude, Codex), `run_shell_command` (Gemini),
  `apply_patch` (Codex). Carries `tool_input.command`.
- **write** — `Write`/`Edit`/`NotebookEdit` (Claude),
  `write_file`/`replace` (Gemini). Carries a file path under one of
  `file_path`, `path`, `notebook_path`, `TargetFile`, `target_file`,
  `AbsolutePath`.

Codex has no file-write tool that fires `PreToolUse`; its edits arrive as
`apply_patch` shell payloads, so `*** Add File:`, `*** Update File:`, and
`*** Move to:` envelope lines are parsed for target paths.

### Decision policy

- **Spec guard** → `deny`. The agent can correct itself from the reason
  text, and asking the user to arbitrate a path convention is noise.
- **Push guard** → `ask` where supported, `deny` elsewhere. Whether to
  push to `main` is the human's call, not a rule the agent should be
  able to route around silently.
- **Bypass** — `CHOWA_GUARDS=off` in the environment disables both
  guards, for the cases neither decision covers (repository bootstrap).

### Opt-in gate

The spec guard applies only when the project opts in, matching SKILL.md
Step 0: `specs/INDEX.md` exists under the payload's `cwd`, or
`~/.chowa-skill/preferences.json` has `{"alwaysOn": true}`. The push
guard stays unconditional — "don't push to main without being asked" is
not a Chōwa-specific convention, and it now asks rather than denies.

## Acceptance Criteria

- Both guards emit a correct denial when invoked through a symlink and
  from a non-ASCII path, verified by a test that spawns the script.
- Process-level tests cover each dialect's payload in and verdict out,
  plus the generic exit-2 fallback.
- `git -C /repo push origin main` and `git push origin HEAD` (on `main`)
  are blocked.
- `echo "text > spec.md"` is not blocked; `sed -i s/a/b/ spec.md` and
  `git mv notes.md spec.md` are.
- The spec guard returns no verdict in a project with no `specs/INDEX.md`
  and no always-on preference.
- One process spawns per tool call, not two.
- `node scripts/install-hooks.mjs --harness <claude|gemini|codex>`
  merges configuration idempotently, and `--dry-run` prints without
  writing.
- `node --test` and `node scripts/generate-skill.mjs --check` pass.
