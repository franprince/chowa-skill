# Spec: Wire up routing config, unify target types, forward fallbacks

Status: **Done** — 2026-08-01. Implemented on branch `fix/routing-config-wiring`.
Both open questions answered by proceeding with the plan's proposed defaults:
(1) yes, extract `loadPolicy()` into its own module; (2) yes, an
explicitly-passed `--config` path that doesn't exist is a hard error.

## Problem Statement

A full-project review surfaced three related defects in the model-routing
path:

1. **`chowa.config.ts` is never loaded.** `loadPolicy()` in `src/cli.ts`
   returns a hardcoded `RoutingPolicy` and ignores both the `--config` flag
   and the `chowa.config.ts` file at the repo root, even though the README,
   `src/integrations/antigravity/skill.md`, and the CLI's own `--help` text
   all document config-driven routing as the intended behavior. Every CLI
   command (`route`, `commit`, `pr`) and both bridges (`AntigravityBridge`,
   `ClaudeCodeBridge`) go through this same stub, so editing the config file
   currently has zero effect on routing decisions.

2. **`ChowaConfig`'s target type doesn't match what the config file needs.**
   `RoutingTargetConfig` (`src/core/types.ts`) has no `fallbacks` field, but
   `chowa.config.ts` assigns `fallbacks` on every target — a shape that only
   exists on `RoutingTarget` (`src/router/types.ts`). This goes undetected
   because `tsconfig.json` only includes `src/**/*.ts`, so `chowa.config.ts`
   is never type-checked by `bun run lint` (`tsc --noEmit`) or CI.

3. **Router-resolved fallbacks are never forwarded to the client.** Even
   where a `RoutingDecision.target.fallbacks` is correctly populated, the two
   production call sites that connect the router to `ChowaClient` —
   `generateCommitMessage` (`src/git/commitMessage.ts`) and
   `generatePRDescription` (`src/git/prDescription.ts`) — build `CallOptions`
   from `decision.target.provider` / `.model` only. `ChowaClient.call()`'s
   failover loop is fully implemented and unit-tested in isolation, but
   nothing in the actual commit/PR flow ever populates `CallOptions.fallbacks`,
   so configured failover targets are silently inert end-to-end.

## Goals

- **G1.** `chowa route`, `chowa commit`, `chowa pr`, and both integration
  bridges resolve routing decisions from the *actual* `chowa.config.ts`
  (or a path passed via `--config`), not a hardcoded stub.
- **G2.** If no config file is found at the resolved path, fall back to the
  existing built-in default policy, with a clear (non-fatal) message.
- **G3.** If a config file *is* found but fails to load or doesn't match the
  expected shape, fail loudly (non-zero exit, clear error) rather than
  silently substituting the default — silent fallback on a broken config a
  human just edited is worse than a crash.
- **G4.** `RoutingTargetConfig` in `src/core/types.ts` accurately reflects
  what `chowa.config.ts` is allowed to contain (i.e. include `fallbacks`),
  and `chowa.config.ts` is included in a type-checking pass that runs as
  part of `bun run lint`, so this class of drift is caught automatically
  going forward.
- **G5.** `generateCommitMessage` and `generatePRDescription` forward
  `decision.target.fallbacks` into `CallOptions.fallbacks`, so a fallback
  configured in `chowa.config.ts` actually gets used when the primary
  provider/model call fails.

## Non-Goals

- Not implementing the OpenAI or local-model adapters (tracked separately on
  the README roadmap).
- Not changing the `chowa.config.ts` *authoring* format — the existing file
  already uses the richer (`fallbacks`-bearing) shape; we're making the type
  system agree with it, not asking users to rewrite their config.
- Not building a general-purpose plugin/schema-validation framework for
  config files — a straightforward structural check is enough at this scale.
- Not guaranteeing `chowa.config.ts` (a `.ts` file) loads under a plain
  `node dist/cli.js` invocation without a TS loader. The project's documented
  workflow runs everything through `bun run src/cli.ts …`, and Bun can import
  `.ts` files natively. Node/`dist` usage will get a clear error if dynamic
  `import()` of a `.ts` file fails, with the same graceful "missing config"
  fallback applying only to a genuinely absent file, not a load failure.
- Not changing `ChowaClient.call()`'s failover algorithm itself — it's
  already correct and tested; the fix is purely about *supplying* it with
  the fallbacks the router already computed.

## Affected Interfaces

- `src/core/types.ts`: `RoutingTargetConfig` gains an optional `fallbacks`
  field mirroring `RoutingTarget.fallbacks`.
- `src/cli.ts`: `loadPolicy(configPath?: string)` becomes a real loader
  (likely extracted to its own module for testability — see plan).
- `src/git/commitMessage.ts`, `src/git/prDescription.ts`: `callOptions` gains
  `fallbacks: decision.target.fallbacks`.
- `tsconfig` / `package.json` `lint` script: extended to type-check
  `chowa.config.ts` alongside `src/**/*.ts`.
- No changes to `ChowaClient`, adapters, or the `resolve()` router function.

## Edge Cases

- No `chowa.config.ts` at the resolved path → use built-in default policy
  (current hardcoded rules), informational message, exit 0.
- `chowa.config.ts` present but throws on import (syntax/runtime error) →
  error surfaced to the user, non-zero exit.
- `chowa.config.ts` present but `default` export doesn't match the expected
  `ChowaConfig` shape (e.g. missing `routing.rules`) → error surfaced,
  non-zero exit, not a silent partial policy.
- `--config <path>` given but file doesn't exist at that path → treated the
  same as "no config found" only if it's the *default* path; an explicitly
  passed path that doesn't exist should error (the user asked for a specific
  file — silently ignoring a typo'd `--config` path would be confusing).
- Relative `--config` paths are resolved against `process.cwd()`, matching
  how `git diff` / `GitOps` already behave.
- `chowa.config.ts` rules whose `target` has no `fallbacks` (fallbacks stay
  optional) — must continue to work exactly as today.

## Acceptance Criteria

- [ ] `bun run src/cli.ts route --kind mechanical --complexity low` reflects
      `chowa.config.ts`'s actual mechanical-task target
      (`gemini-3.6-flash`, not the previously hardcoded `gemini-3-flash`).
- [ ] Deleting/renaming `chowa.config.ts` and re-running the same command
      falls back to the default policy without crashing.
- [ ] Introducing a deliberate type error into `chowa.config.ts` (e.g. an
      unknown property on a target) is caught by `bun run lint`.
- [ ] A new test proves `generateCommitMessage`/`generatePRDescription` pass
      `fallbacks` through to `ChowaClient.call()` — e.g. a mock transport
      that fails for the primary target and succeeds for the fallback,
      asserting `result.usedFallback === true` and the fallback's
      provider/model were used.
- [ ] All existing 92 tests plus new tests pass (`bun test`).
- [ ] `bun run check:imports` and `bun run build` remain clean.

## Open Questions for Approval

1. OK to extract `loadPolicy()` out of `src/cli.ts` into a new
   `src/router/loadPolicy.ts` (or similar) so it's independently unit
   testable, rather than only exercised via the CLI entry point?
2. OK with "explicit `--config` path that doesn't exist is a hard error"
   vs. always silently falling back to defaults? (Spec currently proposes
   hard error only when the user explicitly named a path.)
