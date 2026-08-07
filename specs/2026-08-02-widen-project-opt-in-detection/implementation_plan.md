# Implementation Plan: Widen project opt-in detection + onboarding for un-opted-in projects

Status: **Done** — 2026-08-02. All eight steps implemented and verified:
`bun test` (190/190), `bun run check:imports`, `bun run build`,
`bun run check:skill`, and `bun run lint` all clean. Manually verified
`chowa init` (writes + refuses to overwrite + round-trips through
`chowa route`) and `chowa always-on on|off` (writes/reads
`~/.chowa/preferences.json`, rejects unknown arguments) against a scratch
directory.

Branch: `feat/widen-project-opt-in-detection` (from `develop`).

## 1. `src/integrations/initConfig.ts` (new)

Pure planning module, mirroring the `planInstall` split already used in
`src/integrations/install.ts` (decide-what-to-do vs. do-it stays separate;
the CLI handler performs the actual write).

```ts
export class ConfigAlreadyExistsError extends Error {
  readonly existingPath: string;
  // message names the existing file; doesn't overwrite it.
}

export interface InitPlan {
  readonly targetPath: string; // join(cwd, 'chowa.config.js')
}

export function planInit(cwd: string = process.cwd()): InitPlan;
// Reuses `findConfigPath` from `../router/loadPolicy.js` (no
// re-implementation of the CONFIG_CANDIDATES probing loop). Throws
// ConfigAlreadyExistsError(found) if findConfigPath(cwd) returns a path.

export function defaultConfigFileContents(): string;
// Renders DEFAULT_POLICY (from `../router/loadPolicy.js`) as:
//   const config = { routing: <JSON.stringify(DEFAULT_POLICY, null, 2)> };
//   export default config;
// wrapped in a short header comment pointing at README.md for the config
// shape. DEFAULT_POLICY is already JSON-serializable (RoutingPolicy has no
// function fields), so this is a straight stringify, not a bespoke
// serializer.
```

**Tests** (`tests/integrations/initConfig.test.ts`): real temp directories
via `mkdtempSync(join(tmpdir(), 'chowa-init-'))` (not stubbed `exists`,
since `findConfigPath` isn't itself DI'd and this repo already uses real-fs
checks for this kind of thing — see `install.test.ts`'s
"finds the real skill in this repo" case):
- `planInit` in an empty temp dir returns `targetPath` = `chowa.config.js`
  under that dir.
- `planInit` in a temp dir containing e.g. `chowa.config.js` throws
  `ConfigAlreadyExistsError` with `existingPath` equal to that file.
- Write `defaultConfigFileContents()` to a temp file, then
  `loadPolicy({ cwd: tempDir })` (the real loader, not a mock) resolves to
  a policy that `toEqual(DEFAULT_POLICY)` — the round-trip check the spec's
  acceptance criteria ask for, done as an automated test instead of a
  manual CLI run.

## 2. `src/integrations/preferences.ts` (new)

Same pure/DI-friendly shape as the rest of `integrations/` — parsing and
path logic are testable without touching real `$HOME`; the actual
`writeFileSync`/`mkdirSync` calls live in the CLI handler (step 3), matching
how `handleInstall` in `cli.ts` does its own writes today rather than
`install.ts` doing them internally.

```ts
export interface ChowaPreferences {
  readonly alwaysOn: boolean;
}

export const PREFERENCES_RELATIVE = join('.chowa', 'preferences.json');

export function defaultPreferencesPath(homeDir: string): string;
// join(homeDir, PREFERENCES_RELATIVE) — homeDir passed in (from `homedir()`
// at the call site), not read internally, so this stays pure and testable.

export class InvalidPreferencesError extends Error {}
// Thrown by parsePreferences for invalid JSON or a wrong-shaped object —
// fail loudly on a corrupted/hand-edited file rather than silently
// defaulting to off, matching loadPolicy.ts's own philosophy for
// explicitly-provided config.

export function parsePreferences(raw: string, path: string): ChowaPreferences;
// path is only used in the thrown error message.

export function readPreferences(
  path: string,
  exists: (p: string) => boolean = existsSync,
  readFile: (p: string, enc: 'utf-8') => string = (p, e) => readFileSync(p, e),
): ChowaPreferences;
// Missing file -> { alwaysOn: false }. Present -> parsePreferences(readFile(...)).

export function serializePreferences(prefs: ChowaPreferences): string;
// JSON.stringify(prefs, null, 2) + '\n'
```

**Tests** (`tests/integrations/preferences.test.ts`), stubbed `exists`/
`readFile` (same `only(...)`-style stub as `install.test.ts`):
- `defaultPreferencesPath('/home/x')` → `/home/x/.chowa/preferences.json`.
- `readPreferences` on a missing path → `{ alwaysOn: false }`.
- `readPreferences` on a path whose stub content is `'{"alwaysOn":true}'` →
  `{ alwaysOn: true }`.
- `readPreferences` on invalid JSON content → throws `InvalidPreferencesError`.
- `readPreferences` on valid JSON missing/wrong-typed `alwaysOn` (e.g.
  `'{"alwaysOn":"yes"}'`) → throws `InvalidPreferencesError`.
- `serializePreferences({ alwaysOn: true })` → contains `"alwaysOn": true`
  and ends with a trailing newline.

## 3. `src/cli.ts`

- Add `handleInit()`: calls `planInit()`, `writeFileSync`s
  `defaultConfigFileContents()` to `plan.targetPath` (using the
  already-imported `writeFileSync`), prints the path and a one-line "edit
  routing.rules to customize" hint. Catches `ConfigAlreadyExistsError` (and
  anything else) the same way `handleInstall` does — print
  `error.message`, `process.exitCode = 1`.
- Add `handleAlwaysOn(arg: string | undefined)`:
  - `arg === 'on' | 'off'` → `mkdirSync(dirname(path), { recursive: true })`
    then `writeFileSync(path, serializePreferences({ alwaysOn: arg === 'on' }))`
    (using the already-imported `mkdirSync`/`writeFileSync`/`dirname`),
    print a confirmation naming the path.
  - `arg === undefined` → `readPreferences(path)`, print current state,
    make no changes.
  - anything else → usage error, `process.exitCode = 1`.
  - `path` = `defaultPreferencesPath(homedir())` (`homedir` already
    imported).
- Wire into `main()`'s switch: `case 'init':` → `handleInit()`;
  `case 'always-on':` → `handleAlwaysOn(positionals[1])`.
- Update `printHelp()`: add `init` and `always-on` to the Commands list and
  one example line each.

No new tests at this layer — consistent with the rest of `cli.ts`
(`handleInstall`, `handleCommit`, etc. aren't unit-tested directly; the
logic they call is).

## 4. `src/integrations/install.ts`

Update `globalRulesContent()`'s first bullet to describe the widened signal
set and mention `chowa always-on`, without breaking existing regression
guards:

```
- These conventions apply **only** in projects set up for Chōwa: Chōwa's own
  source, a project with a `chowa.config.ts`, `chowa.config.js`, or
  `chowa.config.mjs` at its root, `chowa` listed as a project dependency, an
  existing `specs/INDEX.md` following Chōwa's spec convention, or — for
  every project you personally work in — after running
  `chowa always-on on`. In any other project, follow that project's own
  conventions instead — do not apply the rules below.
```

Deliberately says "every project you personally work in", not "all
projects", so the existing `not.toMatch(/all projects/i)` guard (regression
test for the original "asserts universal truth from one invocation" bug)
keeps passing — the always-on case is opt-in and explicit, not an assumed
default, so it doesn't reintroduce what that guard exists to catch.

**Test updates** (`tests/integrations/install.test.ts`): existing
`toMatch(/only.*projects set up for Chōwa/s)`, `toMatch(/chowa\.config/)`,
`toMatch(/follow that\s+project's own conventions instead/s)`,
`toMatch(/[Nn]ever push directly to/)`, and
`not.toMatch(/all projects/i)` all keep passing unchanged against the new
text. Add one new assertion: `toMatch(/chowa always-on/)`.

## 5. `plugins/chowa/skills/chowa/SKILL.md` (canonical skill)

Rewrite Step 0. The `<!-- chowa:invocation:start/end -->` region (Claude
Code-specific invocation table) is untouched — `sync-skill.ts` swaps only
that region, so Step 0's prose flows through to the portable copy verbatim.

New Step 0 body (mode 1 unchanged; mode 2 gains the four signals; mode 3
gains the one-time onboarding offer):

```
## Step 0: Detect which project this is

Check the current working directory — and your own persistent preference —
before following anything below:

1. **Self-repo (dogfooding)** — `package.json` has `"name": "chowa"`, and
   `src/cli.ts` exists. This is Chōwa's own source; run its CLI from source.
2. **Chōwa project** — any of the following:
   - a `chowa.config.ts`, `chowa.config.js`, or `chowa.config.mjs` exists at
     the project root;
   - `chowa` is listed in `dependencies` or `devDependencies` of the
     project's `package.json`;
   - `specs/INDEX.md` exists at the project root — the project already
     follows Chōwa's own spec → plan → execute convention by hand;
   - the user explicitly asks, in this conversation, to use Chōwa's
     conventions here — apply Mode 2 for the rest of the session, and
     mention once that `chowa init` would make it persist across sessions;
   - you have a personal always-on preference set: run `chowa always-on`
     with no argument to check. If enabled, treat *every* project as
     Mode 2, regardless of the project-level signals above — routing falls
     back to the built-in default policy in projects with no config of
     their own.
3. **Unrelated project** — none of the above. Say that plainly, **once per
   session, not on every subsequent turn** — then offer, a single time, to
   set the project up: `chowa init` (scaffolds a `chowa.config.js` for this
   project only) or `chowa always-on on` (applies Chōwa's workflow to every
   project you personally work in, from now on). If the user declines or
   doesn't respond, defer to the project's own conventions
   (`CONTRIBUTING.md`, `.agents/workflows/*.md`, or the commit style
   already visible in `git log`) for the rest of the session — don't ask
   again, and don't apply the workflow rules below as if they were in force.

Absent an onboarding acceptance, Mode 3 is still a stop, not a fallback. A
user working in an unrelated project who declines onboarding should not
have Chōwa's branching rules, spec pipeline, or commit conventions applied
to their work just because a plugin happened to be installed globally.
```

Also add two rows to the "Chōwa CLI Reference" table at the bottom:

```
| `chowa init` | Scaffold a `chowa.config.js` for this project |
| `chowa always-on [on\|off]` | Apply (or stop applying) Chōwa's workflow to every project, regardless of per-project signals |
```

## 6. Regenerate the portable skill

```
bun run scripts/sync-skill.ts
```

Writes `.agents/skills/chowa/SKILL.md` from the canonical file above
(invocation-table region swapped, everything else identical). Not hand-
edited — `bun run scripts/sync-skill.ts --check` is part of verification
(step 8) and would fail the build otherwise.

## 7. `README.md`

Update the Install section paragraph (currently: "Then opt a project in by
adding a `chowa.config.ts`... Without one, the skill deliberately stays out
of the way...") to mention the additional signals, `chowa init`, and
`chowa always-on`, keeping the same "installing ≠ applying everywhere,
unless you say otherwise" framing the paragraph already has.

## 8. Verification (before commit)

```
bun test
bun run check:imports
bun run build
bun run scripts/sync-skill.ts --check
bun run lint
```

All five must pass. `check:imports` matters specifically here:
`initConfig.ts` imports `findConfigPath`/`DEFAULT_POLICY` from
`../router/loadPolicy.js`, which is `integrations/ → router/` — the
allowed direction (the boundary check only forbids `core/`, `adapters/`,
`router/`, `git/` importing from `integrations/`).

## Commit clustering (expected, not prescriptive — `chowa commit` decides)

Roughly: (1) `initConfig.ts` + tests, (2) `preferences.ts` + tests,
(3) `cli.ts` wiring + `install.ts` wording + its test update, (4) skill
docs (canonical + regenerated portable) + README. Adjust to whatever
`chowa commit` actually clusters once the diff exists.

## Out of Scope (reaffirmed from spec)

- `.claude/skills/chowa/SKILL.md` (self-repo skill) — unchanged.
- `src/integrations/antigravity/skill.md` — unchanged, no Step 0 concept
  there today.
- The `claude-code-bridge` JSON action set (`init`/`plan`/`start` as bridge
  actions) — deferred to a separate follow-up spec, not this one.
