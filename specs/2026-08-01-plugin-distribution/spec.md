# Spec: Plugin distribution (the repo becomes the distribution channel)

Status: **Draft** — 2026-08-01. Drafted on branch `feat/plugin-distribution`.

## Problem Statement

Chōwa has no installation story. Getting it into a project today means:

1. Clone this repo (there is no published package and no install command).
2. `bun install`, then invoke the CLI as `bun run src/cli.ts <command>`,
   because nothing puts a `chowa` binary on `PATH`.
3. Hand-copy `.claude/skills/chowa/SKILL.md` into `~/.claude/skills/chowa/`
   so Claude Code picks up the workflow rules.
4. Separately run `chowa sync-global` to `cp` `.agents/skills/chowa/SKILL.md`
   into `~/.gemini/config/skills/chowa/` for other harnesses.

Steps 3 and 4 are the visible symptom — step 3 is literally recorded as an
allowlisted shell command in this repo's own `.claude/settings.local.json`
(`cp "…/.claude/skills/chowa/SKILL.md" ~/.claude/skills/chowa/SKILL.md`).
But the manual copying is a symptom of a structural problem, not the problem
itself.

**Root cause: this repo contains two artifacts with different natural
delivery mechanisms, and neither is packaged.**

- **The engine** — the TypeScript CLI (`src/core`, `src/adapters`,
  `src/router`, `src/git`, `src/cli.ts`), which today only runs from a
  source checkout with `node_modules` present.
- **The behavior** — the SKILL.md files that tell an agent harness how to
  use the engine. For Claude Code the natural channel is the plugin system;
  for other harnesses it is a file drop.

Because there is no packaging boundary between the two, the behavior layer
gets distributed by `cp` and the engine gets distributed by "clone the repo".
Three consequences follow:

1. **Skill drift, with a shipped bug already on record.** The same document
   exists three times — `.claude/skills/chowa/SKILL.md`,
   `.agents/skills/chowa/SKILL.md`, and whatever hand-copied state
   `~/.claude/skills/chowa/SKILL.md` happens to be in. Nothing keeps them in
   sync. `specs/2026-08-01-portable-global-skill-sync/spec.md` documents the
   failure this already caused: the global Claude Code copy recited Chōwa's
   own internal dev workflow (`bun run check:imports`, `chowa.config.ts`, an
   in-flight bug) at an unrelated project, because a hand-copied file has no
   notion of which project it is being read in. That was fixed by adding mode
   detection to the *content*; the delivery mechanism that let a stale copy
   diverge is untouched.
2. **No version, no update path, no uninstall.** A copied file has no
   version. A user who copied the skill in June has no way to know a newer
   one exists, no command to update it, and no clean way to remove it.
3. **Workflow rules are advisory prose only.** Every rule in the skill —
   "never push directly to `main`", "run `chowa check-update` before
   committing" — is a sentence the model may or may not act on. Chōwa's
   README calls itself a harness performing "git workflow enforcement"; with
   the current delivery mechanism there is no enforcement anywhere in the
   system, only instruction.

### Framing decision: private, CLI + skill only

Two decisions taken before this spec and assumed throughout:

- **Chōwa is distributed privately**, to its maintainer and anyone
  explicitly given repository access. Public discovery is not a goal.
- **The CLI plus the Claude Code skill is the product.** Chōwa is not
  intended to be consumed as an importable library. The `exports` map in
  `package.json` (`./core`, `./adapters`, `./router`, `./git`, `./client`)
  describes a product that will not be supported, and the README's framing
  of Chōwa as a layer that "sits between your application code and LLM
  providers" overstates what is on offer.

Together these remove npm from the design entirely. npm was only ever going
to do two jobs — host the artifact, and deliver the engine plus its four
runtime dependencies. A private git repo does the first; bundling does the
second. As a side effect, the blocking constraint that the unscoped npm name
`chowa` is occupied by an unrelated package (13 releases, last published
2021-06-30) stops mattering: no name needs to be claimed.

### Feasibility, verified

Three facts were confirmed against current Claude Code documentation and by
direct execution before this design was chosen:

1. **`${CLAUDE_PLUGIN_ROOT}` resolves inside skill content.** The plugin
   reference specifies that for "skill and agent content", path placeholders
   resolve "anywhere the placeholder appears". A skill can therefore name a
   binary bundled beside it and the model receives a real absolute path.
   This is the enabler — without it a git-distributed plugin has no way to
   locate its own engine.
2. **Private repositories are supported** for `/plugin marketplace add` and
   `/plugin install`. Claude Code uses the user's existing git credential
   helpers; HTTPS via `gh auth login` and SSH via a key loaded in
   `ssh-agent` both work. `owner/repo` shorthand clones over SSH by default;
   `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` switches to HTTPS.
3. **The engine bundles to a single self-contained file.** Verified by
   running it: `bun build src/cli.ts --target=node` produced a 220 KB
   `cli.js` which executed `route --kind architecture --complexity high`
   correctly under plain `node` in a directory containing no `node_modules`.
   All four runtime dependencies (`simple-git`, `zod`,
   `zod-to-json-schema`, `jsonrepair`) inline cleanly.
4. **The bundle is byte-reproducible within a Bun version.** Two
   consecutive builds on Bun 1.3.5 produced identical SHA-256 digests. This
   is what makes stale-bundle detection by `git diff` viable at all, and it
   is also why CI must pin its Bun version — reproducibility *across* Bun
   versions is not guaranteed, and an unpinned toolchain would produce
   false failures.
5. **`chowa.config.ts` does not load under every supported Node.** See the
   defect below; this was found while validating the design, not assumed.

### Defect surfaced by this design: runtime TypeScript config loading

`loadPolicy` resolves the config path against `process.cwd()`
(`src/router/loadPolicy.ts:62-64`), so running the engine from the plugin
cache correctly finds the *consumer project's* config — that part is sound.
But line 75 loads it with a dynamic `import()` of a **`.ts`** file. Under
Bun that works natively, which is why it has never failed in this repo.
Under plain `node` it depends on TypeScript type stripping, which is only
unflagged in Node ≥ 22.18 (backported) and ≥ 23.6.

Verified empirically:

- Node 22.22.2, bundled CLI, project containing a `chowa.config.ts`:
  loads correctly, project policy applied.
- Same command with `--no-experimental-strip-types` (simulating Node 20, or
  Node 22.0–22.17): `Failed to load config file … Unknown file extension
  ".ts"`.

`package.json` currently declares `"engines": { "node": ">=20.0.0" }`, which
is **wrong** for this design: on Node 20 — still an active LTS line — any
consumer project with a `chowa.config.ts` fails. Today this is masked
because the CLI is only ever run through Bun from a source checkout.
Distributing a `node`-targeted bundle is what exposes it, so it is in scope
here rather than deferred.

## Goals

- **G1.** Installing Chōwa into a project is two slash commands —
  `/plugin marketplace add franprince/chowa` then
  `/plugin install chowa@chowa` — with no repository clone, no `cp`, and no
  separate step to obtain the engine.
- **G2.** The repository is the distribution channel: the marketplace
  catalog, the plugin, the skill, the hooks, and the runnable engine all
  ship from one `git push`, with `/plugin marketplace update` as the update
  path and git tags as the version record.
- **G3.** One canonical skill document, versioned and shipped inside the
  plugin, replacing the current three-way copy. This repo's
  `.claude/skills/chowa/SKILL.md` is demoted to the self-repo (dogfooding)
  variant it already is and stops being a distribution source.
- **G4.** The plugin is self-contained: everything it needs to run is inside
  the plugin directory, with no path traversal outside it and no dependency
  on a package registry at invocation time.
- **G5.** At least the "never push directly to `main`" rule becomes an
  actual `PreToolUse` hook that blocks the action, rather than prose. This
  is what makes the plugin worth more than the file copy it replaces, and
  makes the README's "workflow enforcement" claim true.
- **G6.** Harnesses without a plugin system (Gemini, Antigravity) keep a
  working install path via an explicit CLI command, with `handleSyncGlobal`
  narrowed to that role rather than acting as Chōwa's general distribution
  mechanism.
- **G7.** `package.json` and `README.md` stop describing a library product
  that is not supported.
- **G8.** A committed bundle that does not match its source cannot reach
  `main`, and cannot reach a user, without a mechanical check failing first.
- **G9.** `chowa.config.ts` loading works on every Node version Chōwa claims
  to support, and the version floor Chōwa declares is the one it actually
  requires.

## Non-Goals

- **Not publishing to npm**, now or as part of this change. Decided; see
  Framing.
- **Not supporting library consumption.** `import { … } from 'chowa/core'`
  is explicitly not a supported use case after this change.
- **Not solving discovery.** A private git marketplace is reachable only by
  users handed the repo name and granted access. That is the intent.
- **Not converting every workflow rule into a hook.** G5 covers push
  protection. Turning the spec → plan → execute pipeline, commit-message
  conventions, or the quality gates into hooks is a larger design problem
  and belongs in a follow-up spec.
- **Not changing any engine behavior** — adapters, router, validation, diff
  splitting, and commit/PR generation are untouched. This spec is packaging
  and delivery only.
- **Not removing `sync-global`.** It narrows in scope (G6) and is renamed,
  but the Gemini/Antigravity path stays supported.
- **Not making the repository private as part of this work.** The repo is
  currently public; flipping it is a one-click action outside the codebase,
  and it does not retract existing clones or forks. Sequencing is the
  maintainer's call (see Open Questions).

## Proposed Design

### Repository layout

The repository root is the marketplace; the plugin is a subdirectory. The
plugin is deliberately *not* at the repo root, because installed plugins are
copied wholesale into `~/.claude/plugins/cache` — a root-level plugin would
copy `src/`, `tests/`, and `specs/` into every user's cache.

```
chowa/                                  (private GitHub repo == marketplace)
├── .claude-plugin/
│   └── marketplace.json                catalog; source: ./plugins/chowa
├── plugins/
│   └── chowa/                          the plugin (self-contained)
│       ├── .claude-plugin/
│       │   └── plugin.json             manifest + version
│       ├── skills/chowa/SKILL.md       THE canonical skill (G3)
│       ├── hooks/hooks.json            push protection (G5)
│       └── dist/cli.js                 bundled engine, committed
├── src/                                engine source (not shipped)
├── tests/
└── specs/
```

```json
// .claude-plugin/marketplace.json
{
  "name": "chowa",
  "owner": { "name": "Fran" },
  "plugins": [
    {
      "name": "chowa",
      "source": "./plugins/chowa",
      "description": "Spec-driven pipeline, atomic commits, PR generation, and model routing"
    }
  ]
}
```

Relative-path sources resolve against the marketplace root (the directory
containing `.claude-plugin/`) and work for users who add the marketplace
from a git source, which is the intended path.

### Invocation contract

The canonical skill keeps the three-mode Step 0 detection already present in
`.agents/skills/chowa/SKILL.md` (self-repo / consumer / not-installed) and
binds `chowa <command>` per mode:

| Mode | Invocation |
|---|---|
| Self-repo (this repository) | `bun run src/cli.ts <command>` |
| Plugin installed | `node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js" <command>` |
| Neither | Report not installed; do not apply workflow rules |

The middle row is what makes G1 and G4 work, and it depends on feasibility
fact 1 above.

### Versioning and release

Version lives in `plugins/chowa/.claude-plugin/plugin.json` and is mirrored
by a git tag. Because the skill and the engine ship in the same commit, they
cannot disagree about their version — this removes an entire class of skew
that an npm-plus-git split would have introduced.

### Bundle lifecycle (mitigates the stale-bundle risk, G8)

The bundled `dist/cli.js` is a build artifact in version control, which is
the principal cost of git-only distribution. Three measures contain it, and
the first is structural rather than procedural.

**1. The bundle exists only on `main`.** It is built and committed as a step
of the `release/*` branch process, never on `develop` or feature branches.
This falls out of the branch flow the repo already enforces: `feat/*` and
`fix/*` PR into `develop`, and only `release/*` and `hotfix/*` PR into
`main`. Users add the marketplace at the repo's default branch, so `main` is
what they install — and `main` only ever receives release merges, which is
exactly when the bundle is rebuilt.

The payoff is that day-to-day development never touches a generated file:
no 220 KB diffs on feature branches, and no merge conflicts on a file whose
only correct resolution is "rebuild from source". Conflicts become possible
only between two concurrent release branches, which is rare and visible.

**2. CI proves the bundle matches its source.** The repository has no CI at
all today, so this is net-new infrastructure, not a tweak. A workflow runs
`bun test`, `bun run check:imports`, and `bun run build` on every PR; on PRs
targeting `main` it additionally runs `bun run build:plugin` followed by
`git diff --exit-code plugins/chowa/dist/`, failing the PR if the committed
bundle differs from a fresh build of that commit's source. The Bun version
is pinned, per feasibility fact 4.

This is the only measure that cannot be forgotten, and it guards the exact
moment the artifact reaches users.

**3. Diff noise is suppressed, not hidden.** `.gitattributes` marks
`plugins/chowa/dist/cli.js` as generated so review tooling collapses it,
while leaving it a normal tracked file that CI still verifies.

### Config loading (mitigates the runtime `.ts` defect, G9)

Three changes, in order of what actually fixes the problem:

**1. `loadPolicy` accepts plain-JavaScript config.** With no explicit
`--config`, the loader probes `chowa.config.ts`, then `chowa.config.js`,
then `chowa.config.mjs`, taking the first that exists. An explicit
`--config` path is used as given, unchanged. Plain JS needs no type
stripping and therefore loads on every Node version, which removes the
runtime-feature dependency for anyone who needs it rather than merely
raising the floor and excluding them.

The `.ts` form stays the documented default — it is the one that gets
type-checked by `tsconfig.lint.json` — but it is no longer the only option.

**2. The declared Node floor becomes the real one.** `engines.node` moves
from `>=20.0.0` to the version at which the `.ts` path actually works
(`>=22.18.0`), with the README stating plainly that Node below that needs
`chowa.config.js` instead. Chōwa should not claim support it does not have.

**3. The failure is actionable when it happens.** `loadPolicy` catches the
`Unknown file extension ".ts"` case specifically and reports what to do —
upgrade Node, or rename the config to `chowa.config.js` — rather than
surfacing a bare stack trace, which is what it does today.

## Affected Interfaces

- **`.claude-plugin/marketplace.json`** (new, repo root) — catalog as above.
- **`plugins/chowa/.claude-plugin/plugin.json`** (new) — `name`,
  `description`, `version`, `author`, `repository`, `license`, `keywords`.
  Component directories are auto-discovered; no custom path fields needed
  with this layout.
- **`plugins/chowa/skills/chowa/SKILL.md`** (new) — canonical skill, derived
  from the already-corrected `.agents/skills/chowa/SKILL.md`, with the
  invocation table above replacing the current mode bindings and the CLI
  reference table updated.
- **`plugins/chowa/hooks/hooks.json`** (new) — `PreToolUse` matcher on
  `Bash` implementing push protection (G5), plus any script it calls under
  `plugins/chowa/scripts/`.
- **`plugins/chowa/dist/cli.js`** (new, generated + committed) — bundled
  engine.
- **`package.json`** — add a `build:plugin` script
  (`bun build src/cli.ts --target=node --outfile=plugins/chowa/dist/cli.js`)
  and a `verify` script chaining test + check:imports + build + bundle
  freshness for local use; **remove** the `exports` map and the
  `prepublishOnly` hook (G7); raise `engines.node` to `>=22.18.0` (G9);
  `bin` retained for local development convenience only. `name` stays
  `chowa` — nothing publishes it, so the collision is irrelevant.
- **`.gitignore`** — currently ignores `dist/` with no leading slash, which
  matches at any depth and would silently swallow
  `plugins/chowa/dist/cli.js` (confirmed via `git check-ignore`: matched by
  `.gitignore:5`). Needs a negation or a narrower pattern. Left unfixed,
  the plugin ships with nothing runnable and the failure is invisible until
  someone installs it.
- **`.gitattributes`** (new) — mark `plugins/chowa/dist/cli.js` generated.
- **`.github/workflows/ci.yml`** (new) — the repository has no CI today.
  Runs the quality gates on every PR and the bundle-freshness check on PRs
  targeting `main`, with a pinned Bun version.
- **`src/router/loadPolicy.ts`** — probe `.ts` / `.js` / `.mjs` when no
  explicit `--config` is given; add the actionable error for the
  type-stripping failure (G9). `DEFAULT_POLICY` and the existing
  fail-loudly-on-explicit-path behavior are unchanged.
- **`.claude/skills/chowa/SKILL.md`** — retained, scoped explicitly to
  self-repo dogfooding; gains a note that it is not the distributed copy.
- **`.agents/skills/chowa/SKILL.md`** — becomes a generated copy of the
  canonical skill rather than an independently maintained document, or is
  replaced by a reference to it (see Open Questions).
- **`src/cli.ts`** — `handleSyncGlobal` renamed and re-scoped to
  `chowa install --agent <harness>` (G6); `sync-global` retained as a
  deprecated alias for one minor version.
- **`README.md`** — Quick Start rewritten around the two slash commands;
  the "sits between your application code and LLM providers" framing and the
  library/import examples corrected to describe a CLI + skill product (G7).

## Edge Cases

- **Stale committed bundle.** The worst failure mode this design
  introduces: someone edits `src/`, updates the skill, releases, and forgets
  to rebuild — so the plugin ships a current skill driving a stale engine,
  silently. Addressed by the bundle lifecycle above; the residual risk is a
  release made by pushing to `main` directly, bypassing the PR that runs the
  check. Branch protection on `main` closes that, and is worth enabling
  regardless.
- **Merge conflicts on the bundle.** Largely designed out by confining the
  bundle to `main`. What remains: two concurrent `release/*` branches both
  rebuilding. Resolution is always "rebuild from source", never a manual
  merge — this belongs in the skill's release guidance.
- **Bun version drift in CI.** Bundle output is reproducible within a Bun
  version but not guaranteed across versions, so an unpinned CI toolchain
  would fail the freshness check on an untouched bundle. The pin must be
  updated deliberately, with the resulting bundle churn landing in its own
  commit.
- **`node` must be on `PATH`.** The bundled CLI is plain JS and needs a
  Node runtime. The skill should verify and fail with a clear message rather
  than producing a confusing shell error. Chōwa's own development uses Bun;
  a consumer machine may have Bun, Node, both, or neither. Note Bun can also
  execute the bundle, and doing so sidesteps the type-stripping constraint
  entirely — worth preferring when present.
- **Config probing must not change explicit-path behavior.** The `.ts` /
  `.js` / `.mjs` probe applies only when no `--config` was given. An
  explicit `--config` that does not exist must still fail loudly, per the
  contract established in `specs/2026-08-01-routing-config-wiring/`.
- **A project with both `chowa.config.ts` and `chowa.config.js`.** The probe
  order makes `.ts` win. This is deterministic but could silently ignore a
  `.js` file the user believed was in effect; the resolved path should be
  reported when the CLI runs verbosely.
- **Repository access is the install gate.** A private marketplace means
  every user needs git credentials for the repo. Failure mode for an
  unauthorized user is a clone failure at `/plugin marketplace add`, which
  should be documented in the README so it isn't mistaken for a broken
  marketplace file.
- **SSH vs HTTPS.** `owner/repo` shorthand clones over SSH by default. A
  user authenticated only via `gh auth login` (HTTPS) needs
  `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`. This must be in the install docs — it
  is the most likely first-run failure.
- **Hook false positives.** A `Bash` matcher for `git push` must block
  `git push origin main` and a bare `git push` while on `main`, without
  blocking `git push origin feat/x` or `git push --set-upstream origin
  release/v0.3.0`. `release/*` and `hotfix/*` branches are legitimately
  pushed before they PR into `main`; a matcher that over-blocks breaks
  Chōwa's own release flow and is worse than the prose it replaces.
- **Path traversal.** Installed plugins cannot reference files outside their
  directory (`../`), because those files are not copied into the cache.
  Nothing in `plugins/chowa/` may reach into `src/`, `chowa.config.ts`, or
  any other repo-root file. The bundle exists precisely to satisfy this.
- **Self-repo double-load.** In this repository both the project-local
  `.claude/skills/chowa/` and, if the maintainer has it installed, the
  plugin's skill are present. The self-repo variant must remain the one that
  governs, and the two must not produce contradictory instructions.
- **Existing hand-copied installs.** `~/.claude/skills/chowa/SKILL.md`
  exists on the maintainer's machine from the manual era. Installing the
  plugin does not remove it and the two can conflict. The README needs an
  explicit "delete the hand-copied file" migration note.
- **Config resolution from a cached plugin.** The engine reads
  `chowa.config.ts` from the *project* directory, not the plugin directory.
  Running `dist/cli.js` out of the plugin cache must still resolve the
  consumer project's config relative to `cwd`; this needs verification, as
  it is the one behavior the relocation could plausibly break.

## Acceptance Criteria

- [ ] `claude plugin validate ./plugins/chowa` reports no errors against the
      manifest, skill frontmatter, and `hooks/hooks.json`.
- [ ] In a scratch project on a machine with no Chōwa checkout:
      `/plugin marketplace add franprince/chowa` and
      `/plugin install chowa@chowa` succeed and the skill is listed.
- [ ] In that scratch project, a Chōwa CLI command issued through the skill
      runs successfully via `node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js"` with
      no clone, no `npm install`, and no network access at invocation time.
- [ ] With a `chowa.config.ts` present in the scratch project,
      `chowa route` run from the plugin cache resolves that project's policy
      and not the built-in default.
- [ ] The same, with a `chowa.config.js`, succeeds under
      `node --no-experimental-strip-types` (proving the plain-JS path is
      genuinely independent of type stripping, G9).
- [ ] A `chowa.config.ts` under a runtime without type stripping produces
      the actionable message naming `chowa.config.js` as the remedy, not a
      bare `Unknown file extension ".ts"` stack trace.
- [ ] An explicit `--config ./nope.ts` still throws rather than falling back
      to the probe or to `DEFAULT_POLICY` — regression guard on
      `specs/2026-08-01-routing-config-wiring/`.
- [ ] In a project with none of Chōwa's preconditions met, the skill's
      Step 0 still reports "not installed" and declines to apply the
      workflow rules — the regression guarded by
      `specs/2026-08-01-portable-global-skill-sync/`.
- [ ] The push-protection hook blocks `git push origin main` and a bare
      `git push` while on `main`; and allows `git push origin feat/x`,
      `git push origin release/v0.3.0`, and `git push --set-upstream origin
      hotfix/y` — verified by direct invocation against each command string.
- [ ] A rebuild of `plugins/chowa/dist/cli.js` from a clean tree produces no
      diff, and a deliberately stale bundle (source edited, bundle not
      rebuilt) fails CI on a PR targeting `main`.
- [ ] `develop` and feature branches contain no `plugins/chowa/dist/`
      artifact, so no generated file appears in day-to-day diffs.
- [ ] `chowa install --agent gemini` writes
      `~/.gemini/config/skills/chowa/SKILL.md` with the canonical content;
      `chowa sync-global` still works and emits a deprecation notice.
- [ ] `bun test`, `bun run check:imports`, and `bun run build` clean.
- [ ] `README.md` Quick Start no longer instructs anyone to clone this repo
      or copy a SKILL.md file in order to use Chōwa, and no longer describes
      an importable library surface.

## Open Questions for Approval

1. **Bundle-on-`main`-only** is the structural half of the stale-bundle
   mitigation and it assumes the marketplace is installed from the default
   branch. Confirm that is acceptable: it means anyone tracking `develop`
   cannot install the plugin from source without building it themselves.
   The alternative — bundle on every branch — restores the diff noise and
   merge conflicts this is designed to avoid.
2. **`.agents/skills/chowa/SKILL.md` fate**: keep it as a generated copy of
   the canonical skill (adds a sync step and a way to forget it), or delete
   it and have `chowa install --agent <x>` read the canonical file out of
   the plugin (cleaner, but changes what this repo's layout looks like to
   anyone reading it without Claude Code)?
3. **Scope of G5 for this iteration**: is push protection alone the right
   cut, or should the pre-commit `chowa check-update` also become a hook
   now? Spec proposes push protection only — one well-tested matcher beats
   two rushed ones.
4. **Repo visibility sequencing**: make the repo private before this lands,
   after it is verified working, or leave it public for now? Going private
   early means the install path is tested under the real auth conditions;
   going private late avoids locking yourself out of a half-migrated setup.
   Spec has no strong lean.
5. **Version for the first plugin release**: `plugin.json` needs a starting
   version. Track `package.json` (`0.3.0`, matching the existing
   `release/v0.3.0`), or start the plugin's own line at `0.1.0` given it is
   a new artifact with a different surface?
6. **Node floor vs. Node 20 LTS** (G9): raising `engines.node` to
   `>=22.18.0` drops a Node line that is still supported. The plain-JS
   config path means Node 20 users are not actually blocked — only the
   `.ts` config form is. Is declaring `>=22.18.0` with a documented Node 20
   fallback the right call, or should the floor stay at 20 and the `.ts`
   form be documented as requiring a newer runtime?
7. **Branch protection on `main`** (Edge Cases §1): the CI freshness check
   only runs on PRs, so a direct push to `main` bypasses it. Enabling branch
   protection closes the last hole, but it is a repository setting rather
   than a code change — in scope for this spec, or handled separately?
