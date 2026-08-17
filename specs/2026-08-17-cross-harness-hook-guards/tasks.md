# Tasks: Cross-Harness Hook Guards

- [x] T1 — `scripts/lib/direct-run.mjs`: realpath-based `isDirectRun`, applied to all five scripts that carry the naive check.
- [x] T2 — `scripts/lib/shell.mjs`: quote-aware `splitSegments`/`tokenize`, `redirectTargets`, `applyPatchTargets`.
- [x] T3 — `scripts/lib/harness.mjs`: dialect table, `detectDialect`, `normalize`, `emit` (including generic exit-2 fallback).
- [x] T4 — `scripts/lib/opt-in.mjs`: `isOptedIn(cwd)` and `CHOWA_GUARDS=off`.
- [x] T5 — `guard-push.mjs`: fix `-C` ordering and `git push origin HEAD`; `ask` where supported.
- [x] T6 — `guard-spec.mjs`: normalized request, opt-in gate, `apply_patch` targets, `notebook_path`.
- [x] T7 — `scripts/guard.mjs`: single dispatcher, one process per tool call.
- [x] T8 — `hooks/hooks.json` rewired; `hooks/gemini-settings.json` and `hooks/codex-hooks.json` added.
- [x] T9 — `scripts/install-hooks.mjs` with `--harness`, `--scope`, `--dry-run`.
- [x] T10 — Tests: `lib-shell`, `harness`, `guard-cli` (process-level, symlink + non-ASCII), `install-hooks`; extend `guard-push`/`guard-spec`.
- [x] T11 — Docs: template §5 rewrite, regenerate `SKILL.md`, README install section, `specs/INDEX.md` row.
- [x] T12 — Verify: `node --test`, `node scripts/generate-skill.mjs --check`, manual run under all three dialects.
