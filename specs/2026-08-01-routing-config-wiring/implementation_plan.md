# Implementation Plan: Wire up routing config, unify target types, forward fallbacks

Status: **Done** — 2026-08-01. All three fixes implemented and verified:
`bun test` (98/98), `bun run lint` (now covers `chowa.config.ts`),
`bun run check:imports`, and `bun run build` all clean. Manually verified
`chowa route` reflects the real config, falls back cleanly when the config
is absent, and hard-errors on a missing explicit `--config` path.

## Overview

Three independent fixes, ordered so each is independently testable and none
blocks the others: (1) unify the target type, (2) make config loading real,
(3) forward fallbacks. Order matters only in that (1) must land before (2),
since the real loader needs `RoutingTargetConfig` to actually match
`chowa.config.ts`.

## 1. Unify `RoutingTargetConfig` with `RoutingTarget` (G2, G4)

**File: `src/core/types.ts`**

Add the missing field so the type core exposes matches what `chowa.config.ts`
already contains:

```ts
export interface RoutingTargetConfig {
  readonly provider: string;
  readonly model: string;
  readonly fallbacks?: readonly Omit<RoutingTargetConfig, 'fallbacks'>[];
}
```

No changes to `RoutingRuleConfig` or `ChowaConfig` — they already compose
`RoutingTargetConfig` correctly, they just inherited the missing field.

**File: `tsconfig.json` → new `tsconfig.lint.json`**

`tsconfig.json`'s `rootDir: "./src"` means it can't include root-level
`chowa.config.ts` without breaking `bun run build` (files outside `rootDir`).
Add a sibling config used only for type-checking:

```jsonc
// tsconfig.lint.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "chowa.config.ts"]
}
```

**File: `package.json`**

```diff
- "lint": "tsc --noEmit",
+ "lint": "tsc --noEmit -p tsconfig.lint.json",
```

`build` keeps using the original `tsconfig.json` unchanged — `dist/` still
only ever contains compiled `src/`.

**Verification:** temporarily add a bogus property to a target in
`chowa.config.ts`, confirm `bun run lint` fails; remove it, confirm it
passes. Confirm `bun run build` output is unchanged (no `chowa.config.js` in
`dist/`).

## 2. Make `loadPolicy()` load the real config (G1, G2, G3)

**New file: `src/router/loadPolicy.ts`**

Extracted out of `cli.ts` so it's unit-testable without spawning the CLI.

```ts
import { resolve as resolvePath } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { RoutingPolicy } from './types.js';
import type { ChowaConfig } from '../core/types.js';

const DEFAULT_POLICY: RoutingPolicy = {
  // exactly today's hardcoded fallback in cli.ts, moved here verbatim
  rules: [ /* mechanical/security/architecture rules, unchanged */ ],
  defaultTarget: { provider: 'anthropic', model: 'claude-sonnet-4.6' },
};

export interface LoadPolicyOptions {
  readonly configPath?: string;
  readonly cwd?: string;
}

export async function loadPolicy(options: LoadPolicyOptions = {}): Promise<RoutingPolicy> {
  const cwd = options.cwd ?? process.cwd();
  const explicitPath = options.configPath;
  const resolvedPath = resolvePath(cwd, explicitPath ?? 'chowa.config.ts');

  if (!existsSync(resolvedPath)) {
    if (explicitPath) {
      throw new Error(`Config file not found at "${resolvedPath}" (from --config)`);
    }
    return DEFAULT_POLICY; // no config at default location — use built-ins
  }

  const mod = await import(pathToFileURL(resolvedPath).href);
  const config = mod.default as ChowaConfig | undefined;

  validateChowaConfig(config, resolvedPath); // throws with a clear message on shape mismatch

  return config!.routing as RoutingPolicy; // shapes now agree post-fix-1
}

function validateChowaConfig(config: unknown, path: string): asserts config is ChowaConfig {
  if (!config || typeof config !== 'object' || !('routing' in config)) {
    throw new Error(`Invalid chowa.config.ts at "${path}": missing default export with a "routing" key`);
  }
  const routing = (config as ChowaConfig).routing;
  if (!routing || !Array.isArray(routing.rules) || !routing.defaultTarget) {
    throw new Error(`Invalid chowa.config.ts at "${path}": "routing" must have "rules" (array) and "defaultTarget"`);
  }
}
```

**File: `src/cli.ts`**

- Delete the inline `loadPolicy()` stub (lines ~215-240).
- Replace its 5 call sites with:
  ```ts
  const { loadPolicy } = await import('./router/loadPolicy.js');
  const policy = await loadPolicy({ configPath: values.config });
  ```
- On load failure, let `main()`'s existing top-level `.catch` print the error
  and set `process.exitCode = 1` — no new error-handling path needed, this
  already exists at the bottom of `cli.ts`.

**Files: `src/integrations/antigravity/bridge.ts`, `src/integrations/claude-code/bridge.ts`**

No change needed — both bridges already receive `policy: RoutingPolicy` as a
constructor argument from whoever wires them up (`handleAntigravityBridge` /
`handleClaudeCodeBridge` in `cli.ts`), which already calls `loadPolicy()`.
Fixing the one shared call site fixes both bridges.

**Verification:**
- New test file `tests/router/loadPolicy.test.ts`: loads a fixture config
  from a temp directory, asserts the returned policy matches; asserts
  missing-file-at-default-path returns `DEFAULT_POLICY`; asserts explicit
  missing `--config` path throws; asserts malformed config (e.g. no
  `routing` key) throws with a descriptive message.
- Manual check: `bun run src/cli.ts route --kind mechanical --complexity low`
  now prints `gemini-3.6-flash` (from `chowa.config.ts`), matching the repo
  root config instead of the old hardcoded `gemini-3-flash`.

## 3. Forward fallbacks into `CallOptions` (G5)

**File: `src/git/commitMessage.ts`**

```diff
   const callOptions: CallOptions = {
     provider: decision.target.provider,
     model: decision.target.model,
+    fallbacks: decision.target.fallbacks,
     tools: [],
     messages: [ /* unchanged */ ],
   };
```

**File: `src/git/prDescription.ts`** — identical one-line addition.

**Verification:** new test in `tests/git/commitMessage.test.ts` (and a
matching one in `prDescription.test.ts`): construct a `RoutingPolicy` whose
`mechanical` rule has a `fallbacks` entry, use a mock `Transport` whose
`send()` throws for the primary provider and succeeds for the fallback
provider, call `generateCommitMessage`, assert the returned message was
generated and (via a spy on the transport, or by inspecting call args) that
the fallback target was actually invoked.

## Test Plan Summary

| Area | New/changed tests |
|---|---|
| `core/types.ts` | none (type-only change, covered by `tsc`) |
| `chowa.config.ts` type-checking | manual verification step (see §1), no vitest needed |
| `loadPolicy` | new `tests/router/loadPolicy.test.ts` (4 cases: real config, missing default, missing explicit, malformed) |
| `commitMessage` fallback forwarding | extend `tests/git/commitMessage.test.ts` |
| `prDescription` fallback forwarding | extend `tests/git/prDescription.test.ts` |

Existing 92 tests must continue passing unmodified except where a test was
directly asserting the *old* hardcoded-stub behavior of `loadPolicy()` (none
currently do — it's not unit tested today, only reachable through the CLI).

## Verification Checklist (Stage 3 exit criteria)

- [ ] `bun test` — all pass (92 existing + ~6 new)
- [ ] `bun run check:imports` — clean
- [ ] `bun run build` — clean, `dist/` unchanged in shape (no stray
      `chowa.config.js`)
- [ ] `bun run lint` — clean on current `chowa.config.ts`, fails on a
      deliberately-broken copy (manual smoke test, then revert)
- [ ] `bun run src/cli.ts route --kind mechanical --complexity low` reflects
      `chowa.config.ts`
- [ ] Rename `chowa.config.ts` temporarily → same command falls back to
      default policy without crashing → rename back

## Rollout

Per the chowa skill's own workflow: create a feature branch (suggest
`fix/routing-config-wiring`), implement in the order above as separate
atomic commits (one per numbered section, via `chowa commit`'s own
diff-splitting once it's dogfooded), then ask before opening a PR.
