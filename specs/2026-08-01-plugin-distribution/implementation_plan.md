# Implementation Plan: Plugin distribution (the repo becomes the distribution channel)

Status: **Draft** — 2026-08-01. Plans `specs/2026-08-01-plugin-distribution/spec.md`.

## Provisional answers to the spec's open questions

The spec's seven open questions were not answered before planning. Each is
resolved below with a default so the plan is concrete; all are cheap to
override, since only Phase 5 and Phase 6 depend on any of them.

| # | Question | Provisional answer | Rationale |
|---|---|---|---|
| 1 | Bundle on `main` only? | **Yes** | Matches the branch flow already enforced; removes generated-file churn from daily work by construction. |
| 2 | `.agents/skills/chowa/SKILL.md` fate | **Generated from canonical, CI-verified** | Keeps the repo legible without Claude Code. Drift is what this spec exists to kill, so the copy gets the same freshness check as the bundle. |
| 3 | Hook scope | **Push protection only** | One well-tested matcher over two rushed ones. `check-update` as a hook is a follow-up. |
| 4 | Repo visibility sequencing | **Verify working, then flip private** | Testing the install path is easier public; going private early risks locking yourself out mid-migration. |
| 5 | First plugin version | **`0.3.0`, tracking `package.json`** | The spec's whole premise is that skill and engine ship together; two version lines would reintroduce skew. |
| 6 | Node floor | **Keep `>=20.0.0`** — *departs from the spec's lean* | With the `.js` config path landed in Phase 1, Node 20 genuinely works. Raising the floor to 22.18 would exclude users who are not actually blocked. Only the `.ts` config form needs the newer runtime, and that is a documentation matter. |
| 7 | Branch protection on `main` | **Out of code scope, required in rollout** | It is a repository setting, not a change to this codebase, but the CI guard has a hole without it. Listed as a rollout step. |

Question 6 is the one worth a second look before execution: the spec proposed
raising `engines.node`, and this plan argues the opposite once the plain-JS
config path exists. If the `.js` fallback is cut from Phase 1, the floor must
rise instead.

## Phasing

Seven phases, ordered so each is independently verifiable and the risky work
comes after the cheap work. Phase 1 is a standalone bug fix that is worth
landing on its own merits regardless of the rest.

---

### Phase 1 — Fix runtime config loading (G9)

Independent of distribution. Ships alone if the rest slips.

**Modify** `src/router/loadPolicy.ts`:

- Extract a `CONFIG_CANDIDATES = ['chowa.config.ts', 'chowa.config.js',
  'chowa.config.mjs']` probe order, used **only** when `options.configPath`
  is absent. An explicit `--config` continues to resolve exactly as given
  and to throw when missing — the contract from
  `specs/2026-08-01-routing-config-wiring/` is unchanged and is regression-
  tested below.
- Return `DEFAULT_POLICY` only when *no* candidate exists.
- Wrap the dynamic `import()` failure: when the message matches the
  `Unknown file extension ".ts"` shape, throw an error naming both remedies
  (Node ≥ 22.18, or rename to `chowa.config.js`) instead of surfacing the
  raw cause. Every other load failure keeps its current message.
- Expose the resolved path on the returned result or via a debug log so
  "which config won" is answerable when both `.ts` and `.js` exist.

**Modify** `package.json` — no `engines` change (open question 6).

**Tests** (`tests/router/loadPolicy.test.ts`, extending the existing file):

- `.js` config is found and loaded when no `.ts` exists.
- `.mjs` likewise.
- `.ts` wins when both `.ts` and `.js` are present.
- No candidate present → `DEFAULT_POLICY`.
- Explicit `--config` at a missing path → throws (regression guard).
- Explicit `--config` pointing at a valid `.js` → loads it.
- The type-stripping failure produces the actionable message. Simulating a
  runtime without type stripping inside Vitest-on-Bun is not
  straightforward; if it cannot be done cleanly, assert on the error-mapping
  function in isolation with a synthetic cause rather than skipping the
  case.

**Fixtures**: add `tests/fixtures/chowa-config-valid.config.js` alongside the
existing `.config.ts` fixtures.

---

### Phase 2 — Build tooling and version control hygiene

**Modify** `package.json`:

- Add `"build:plugin": "bun build src/cli.ts --target=node --outfile=plugins/chowa/dist/cli.js"`.
- Add `"verify": "bun test && bun run check:imports && bun run build"` for
  local use (bundle freshness is CI's job, per Phase 5).
- **Remove** the `exports` map and `prepublishOnly` (G7). Keep `bin` for
  local development, keep `main`/`types` pointing at `dist/` for the
  existing `tsc` build.

**Modify** `.gitignore` — `dist/` at line 5 matches at any depth and would
swallow the bundle (confirmed with `git check-ignore`). Add a negation
immediately after it:

```gitignore
dist/
!plugins/chowa/dist/
```

Verify with `git check-ignore -v plugins/chowa/dist/cli.js` returning
nothing. Getting this wrong ships a plugin with no engine and no error.

**Create** `.gitattributes`:

```
plugins/chowa/dist/cli.js linguist-generated=true -diff
```

---

### Phase 3 — Plugin skeleton and canonical skill (G1–G4)

**Create** `.claude-plugin/marketplace.json` (repo root) — name `chowa`,
owner, one plugin entry with `"source": "./plugins/chowa"`.

**Create** `plugins/chowa/.claude-plugin/plugin.json` — name `chowa`,
description, `"version": "0.3.0"`, author, repository, license, keywords.
No custom component paths; the default layout is used so discovery is
automatic.

**Create** `plugins/chowa/skills/chowa/SKILL.md` — the canonical skill,
derived from the already-corrected `.agents/skills/chowa/SKILL.md`. Changes
from that source:

- Step 0's mode table becomes the spec's invocation contract: self-repo →
  `bun run src/cli.ts`; plugin installed → `node
  "${CLAUDE_PLUGIN_ROOT}/dist/cli.js"`; neither → report and stop.
- A runtime preflight: if `node` is absent, say so plainly. Prefer `bun` to
  run the bundle when present, which also sidesteps the type-stripping
  constraint entirely.
- CLI reference table updated for `chowa install --agent` (Phase 6).

**Create** `scripts/sync-skill.ts` — regenerates
`.agents/skills/chowa/SKILL.md` from the canonical file (open question 2).
Provider-neutral: strips the `${CLAUDE_PLUGIN_ROOT}` row, which is
Claude-Code-specific, and substitutes the file-drop invocation. Run manually;
verified by CI in Phase 5.

**Modify** `.claude/skills/chowa/SKILL.md` — add a header note that it
governs only this repository and is not the distributed copy. Content
otherwise unchanged; it is already correctly scoped.

**Boundary check**: everything here is data and docs. No new imports, so
`src/core|adapters|router|git` stay clean of `src/integrations`. Phase 6 is
the only phase touching that boundary and it does not cross it.

---

### Phase 4 — Push-protection hook (G5)

The riskiest component: a matcher that over-blocks breaks Chōwa's own
release flow and is worse than the prose it replaces.

**Create** `plugins/chowa/hooks/hooks.json` — a `PreToolUse` entry with
`"matcher": "Bash"` invoking the guard script via
`"${CLAUDE_PLUGIN_ROOT}"/scripts/guard-push.sh`.

**Create** `plugins/chowa/scripts/guard-push.sh` (mode `+x`). Reads the hook
payload on stdin, extracts `tool_input.command`, and decides:

| Command | Verdict |
|---|---|
| `git push origin main` | block |
| `git push origin master` | block |
| `git push origin HEAD:main` | block |
| `git push --force origin main` | block |
| `git push` while on `main` | block |
| `git push origin feat/x` | allow |
| `git push origin release/v0.3.0` | allow |
| `git push --set-upstream origin hotfix/y` | allow |
| `git push` while on `feat/x` | allow |
| anything that is not `git push` | allow |

Notes for implementation:

- Resolving a bare `git push` requires the current branch (`git rev-parse
  --abbrev-ref HEAD`) — the script must handle being invoked outside a git
  repo without erroring.
- Compound commands (`cd x && git push origin main`) must still be caught;
  match on the `git push` segment, not on the string prefix.
- Fail **open** on a parse failure. A guard that blocks unrecognized input
  makes the tool unusable; a guard that misses an exotic case leaves the
  prose rule as backstop.
- The exact blocking mechanism (exit code 2 with stderr vs. structured JSON
  `permissionDecision`) must be confirmed against the current hooks
  reference during implementation rather than assumed — both forms exist and
  the reference is the authority.

**Tests** `tests/hooks/guardPush.test.ts` — table-driven over the matrix
above, invoking the script with synthetic payloads. This is the one piece
whose failure mode is silent breakage of the maintainer's own workflow, so
the table is the acceptance criterion, not a smoke test.

---

### Phase 5 — CI (G8)

**Create** `.github/workflows/ci.yml`. The repository has no CI today, so
this is net-new.

- Trigger: `pull_request` and `push`.
- Pin the Bun version explicitly (bundle output is reproducible within a Bun
  version, verified, but not guaranteed across them — an unpinned toolchain
  produces false failures on an untouched bundle).
- All PRs: `bun install --frozen-lockfile`, `bun test`, `bun run
  check:imports`, `bun run build`.
- All PRs: `bun run scripts/sync-skill.ts` then `git diff --exit-code
  .agents/skills/` — catches a canonical skill edited without regenerating
  the copy.
- PRs targeting `main` only: `bun run build:plugin` then `git diff
  --exit-code plugins/chowa/dist/` — fails if the committed bundle does not
  match a fresh build of that commit's source.

---

### Phase 6 — `chowa install --agent` (G6)

**Modify** `src/cli.ts`:

- Rename `handleSyncGlobal` → `handleInstall`, taking an `--agent
  <harness>` argument (`gemini` initially; unknown values error with the
  supported list rather than silently no-op).
- Source the skill from the canonical file. In self-repo mode that is the
  path on disk; when running from the plugin cache it is
  `${CLAUDE_PLUGIN_ROOT}/skills/chowa/SKILL.md`, resolved relative to the
  running script rather than `cwd`.
- Keep `sync-global` as an alias that prints a deprecation notice and
  delegates.
- The corrected `globalAgentsContent` wording from
  `specs/2026-08-01-portable-global-skill-sync/` (G3 there) carries over
  unchanged — do not regress it.

**Tests**: extend the existing CLI-level coverage for the alias and the
unknown-agent error. Filesystem writes to `~` are mocked, not performed.

---

### Phase 7 — Documentation (G7)

**Modify** `README.md`:

- Quick Start becomes the two slash commands. Remove "clone this repo" and
  every `cp … SKILL.md` instruction as a means of installing.
- Correct the opening framing: Chōwa is a CLI plus a Claude Code skill, not
  a layer applications import. Remove library/import examples and the
  `exports` surface description.
- Document the Node story: works on Node 20+; `chowa.config.ts` needs Node
  ≥ 22.18 or Bun, otherwise use `chowa.config.js`.
- Document `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` for users authenticated over
  HTTPS rather than SSH — the most likely first-run failure.
- Migration note: delete any hand-copied `~/.claude/skills/chowa/SKILL.md`,
  which will otherwise conflict with the plugin's copy.
- Update the architecture diagram and Project Structure tree for
  `plugins/chowa/`.

---

## Rollout

1. Land Phases 1–7 through `develop` per the normal flow. `develop` carries
   **no** `plugins/chowa/dist/` artifact.
2. Cut `release/*`, run `bun run build:plugin`, commit the bundle on that
   branch, PR into `main`. CI's freshness check runs here for the first
   time.
3. Enable branch protection on `main` (open question 7) — without it a
   direct push bypasses the only guard against a stale bundle.
4. Verify end-to-end from a scratch project while the repo is still public:
   `/plugin marketplace add franprince/chowa`, `/plugin install
   chowa@chowa`, then exercise a command and a blocked push.
5. Flip the repository private (open question 4). Re-verify install with
   credentials in play, both SSH and the `PREFER_HTTPS` path.
6. Delete the stale hand-copied `~/.claude/skills/chowa/SKILL.md`.

## Test plan summary

| Area | Level | Where |
|---|---|---|
| Config probe order, explicit-path contract, error mapping | unit | `tests/router/loadPolicy.test.ts` |
| Push-guard verdict matrix | unit, table-driven | `tests/hooks/guardPush.test.ts` |
| `install --agent`, deprecated alias, unknown agent | unit, mocked fs | `tests/integrations/` |
| Import boundary | existing | `tests/boundary.test.ts`, `scripts/check-imports.ts` |
| Bundle freshness, skill-copy freshness | CI | `.github/workflows/ci.yml` |
| Plugin manifest validity | manual + CI | `claude plugin validate ./plugins/chowa` |
| End-to-end install, config resolution from cache | manual | Rollout steps 4–5 |

The two things that cannot be unit-tested — that a real `/plugin install`
works, and that the engine resolves a consumer's `chowa.config.*` when run
out of the plugin cache — are covered by the rollout verification steps and
are the reason step 4 happens before the repo goes private.

## Risks

- **The push guard is the only piece that can break the maintainer's own
  workflow.** Mitigated by failing open and by the verdict matrix being an
  acceptance criterion rather than a nice-to-have.
- **Phase 2's `.gitignore` negation is easy to get wrong and silent when
  wrong.** Mitigated by an explicit `git check-ignore` verification step.
- **Phase 6 changes a file that writes to the user's home directory.** The
  regression it must not reintroduce is documented in
  `specs/2026-08-01-portable-global-skill-sync/`; re-read that spec's G3
  before touching `globalAgentsContent`.
- **CI is new infrastructure.** Until it is green and required, the
  freshness guarantees in this plan are aspirational rather than enforced.
