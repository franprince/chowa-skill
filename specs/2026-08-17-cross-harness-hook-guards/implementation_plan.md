# Implementation Plan: Cross-Harness Hook Guards

- **Date**: 2026-08-17
- **Spec**: [spec.md](spec.md)

## Architecture

The guards split into three layers, so harness differences are resolved
once instead of per guard:

```
harness payload (stdin JSON)
        │
        ▼
scripts/lib/harness.mjs      detectDialect → normalize → { kind, command, filePaths, cwd }
        │
        ▼
scripts/guard.mjs            dispatcher: runs both decide()s, first block wins
        │  ├── guard-push.mjs  decide(command, resolveBranch)
        │  └── guard-spec.mjs  decide(request)
        ▼
scripts/lib/harness.mjs      emit(verdict, dialect) → dialect-specific JSON, or exit 2
```

`decide()` in both guards stays pure and harness-agnostic — it now takes
a normalized request rather than a raw tool payload, which is what makes
one implementation serve three harnesses.

## Files to create

| File | Purpose | Findings |
|---|---|---|
| `scripts/lib/direct-run.mjs` | `isDirectRun(importMetaUrl)` — realpath-based, symlink and non-ASCII safe | 1 |
| `scripts/lib/shell.mjs` | quote-aware `splitSegments`, `tokenize`, `redirectTargets`, `applyPatchTargets` | minor, G2 |
| `scripts/lib/harness.mjs` | dialect table, `detectDialect`, `normalize`, `emit` | 2, 3, 6, G2, G3 |
| `scripts/lib/opt-in.mjs` | `isOptedIn(cwd)`, `guardsDisabled()` | 2, 3 |
| `scripts/guard.mjs` | single dispatcher entry point for all harnesses | 8 |
| `scripts/install-hooks.mjs` | idempotent config merge per harness | G4 |
| `hooks/gemini-settings.json` | ready-to-merge `BeforeTool` config | G4 |
| `hooks/codex-hooks.json` | ready-to-merge `PreToolUse` config | G4 |
| `tests/lib-shell.test.mjs` | quoting, redirects, apply_patch envelopes | minor |
| `tests/harness.test.mjs` | detection, normalization, emission per dialect | G2, G3 |
| `tests/guard-cli.test.mjs` | **process-level**: spawn, stdin payload, assert stdout/exit | 1, 5 |
| `tests/install-hooks.test.mjs` | merge idempotency, dry-run | G4 |

## Files to modify

| File | Change | Findings |
|---|---|---|
| `scripts/guard-push.mjs` | `-C` ordering, `HEAD` refspec, quote-aware tokens, `ask` policy, shared `isDirectRun` | 1, 3, 4 |
| `scripts/guard-spec.mjs` | normalized request in, opt-in gate, `apply_patch`, quote-aware, shared `isDirectRun` | 1, 2, 6 |
| `scripts/generate-skill.mjs`, `bump-version.mjs`, `storybook-proof.mjs` | shared `isDirectRun` | 1 |
| `hooks/hooks.json` | single dispatcher, add `NotebookEdit` | 6, 8 |
| `templates/chowa-workflow.md` | rewrite §5 for three harnesses, drop `.agents/hooks.json` | 7 |
| `skills/chowa-skill/SKILL.md` | regenerated | 7 |
| `README.md` | per-harness install | G4 |
| `specs/INDEX.md` | new row | convention |

## Test plan

- **Unit** — `decide()` for both guards against the normalized request
  shape, including every bypass and false positive named in the spec.
- **Dialect** — one normalized request produced from each harness's real
  payload shape; one verdict rendered into each harness's deny schema.
- **Process** — spawn `scripts/guard.mjs` with a payload on stdin, from
  the canonical path, through a symlink, and from a directory with
  non-ASCII characters in its name. This is the layer that had no
  coverage and where finding 1 lived.
- **Regression** — the existing 39 tests keep passing unchanged in
  intent; `guard-push`/`guard-spec` test files are extended, not
  replaced.

## Sequencing

1. `lib/` modules + their tests (nothing depends on the guards yet).
2. Guard rewrites against the new lib, extending existing tests.
3. Dispatcher, harness configs, installer, process-level tests.
4. Docs: template §5, regenerate skill, README, INDEX.
5. Full verification: `node --test`, `--check`, manual three-dialect run.
