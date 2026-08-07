# Implementation Plan: PR templates by branch flow

Status: **Approved** — original plan (items 1-6 below) shipped on this
branch. **Amendment** below covers pulling `feat/*` out into its own
`feature` type, on top of that already-shipped code.

Spec: [spec.md](spec.md)

## Files to modify (original plan — shipped)

### 1. `src/git/types.ts`

Extend `PRDescription`:

```ts
export type PRType = 'standard' | 'release';

export interface PRDescription {
  readonly type: PRType;
  readonly summary: string;
  readonly changes: readonly string[];
  readonly testing: string;
  readonly breakingChanges?: string;
  readonly rolloutPlan?: string; // present only when type === 'release'
}
```

`PRType` is exported here (types module) rather than from
`prDescription.ts`, consistent with how `CommitInfo`/`PRDescription`
already live in `types.ts` and `prDescription.ts` only has behavior.

### 2. `src/git/prDescription.ts`

- Add `export function detectPRType(branchName: string): PRType`:
  ```ts
  export function detectPRType(branchName: string): PRType {
    return branchName.startsWith('release/') || branchName.startsWith('hotfix/')
      ? 'release'
      : 'standard';
  }
  ```
- Split the existing `PR_DESCRIPTION_SYSTEM_PROMPT` into two prompts:
  - `STANDARD_PR_SYSTEM_PROMPT` — exactly today's prompt/JSON contract
    (`summary`, `testing`, `breakingChanges`), unchanged wording.
  - `RELEASE_PR_SYSTEM_PROMPT` — same contract plus a required
    `rolloutPlan` string field. Prompt instructs: "rolloutPlan: how this
    release/hotfix will be rolled out and, if something goes wrong, how
    to roll it back — required, never null."
- `generatePRDescription` signature becomes:
  ```ts
  export async function generatePRDescription(
    commits: readonly CommitInfo[],
    baseBranchDiff: string,
    client: ChowaClient,
    policy: RoutingPolicy,
    branchName: string,
  ): Promise<PRDescription>
  ```
  (`branchName` appended at the end to minimize positional-arg churn in
  existing call sites' other arguments — call sites updated in this plan
  regardless since the param is required.)
  - Compute `const prType = detectPRType(branchName);` at the top.
  - Select system prompt based on `prType`.
  - Update `parseLLMResponse` (or add a sibling) to also extract
    `rolloutPlan` when present, defaulting to a fixed fallback string
    (`'Rollout/rollback plan not generated — document manually before
    merging.'`) if the LLM response is malformed or omits it **and**
    `prType === 'release'`. For `prType === 'standard'`, `rolloutPlan` is
    never set (stays `undefined`), regardless of what the LLM returns.
  - Return object includes `type: prType` and, conditionally,
    `rolloutPlan`.

### 3. `src/cli.ts` (`handlePR`)

- Pass `currentBranch` (already fetched at the top of `handlePR`) as the
  5th argument to `generatePRDescription`.
- After the existing `Breaking Changes` console output, add:
  ```ts
  if (pr.type === 'release' && pr.rolloutPlan) {
    console.log(`## Rollout / Rollback Plan\n${pr.rolloutPlan}\n`);
  }
  ```

### 4. `src/integrations/claude-code/bridge.ts` (`handlePR`)

- Add `const currentBranch = await gitOps.getCurrentBranch();` (not
  currently called in this method — `getCommitHistory`/
  `getDiffAgainstBase` are called against `baseBranch`, but the *current*
  branch is never fetched here today).
- Pass `currentBranch` as the 5th argument to `generatePRDescription`.
- No other changes — `data: { baseBranch, prDescription }` already
  forwards the whole object, so `type`/`rolloutPlan` reach the caller for
  free.

### 5. `tests/git/prDescription.test.ts`

Add cases (using the existing `createMockTransport` helper):

- `detectPRType` unit tests (import it directly): `'release/1.4.0'` →
  `'release'`, `'hotfix/login-500'` → `'release'`, `'feat/foo'` →
  `'standard'`, `'fix/bar'` → `'standard'`, `'docs/baz'` → `'standard'`,
  `'main'` → `'standard'`, `'random-name'` → `'standard'`.
- `generatePRDescription(..., 'feat/foo')` with a mock response containing
  no `rolloutPlan` → `pr.type === 'standard'`, `pr.rolloutPlan ===
  undefined`. (Matches today's existing tests — update their call sites
  to pass the new 5th arg with a `'feat/foo'`-style branch name so the
  existing assertions keep passing unchanged.)
- `generatePRDescription(..., 'release/1.4.0')` with a mock response
  containing `rolloutPlan: 'Deploy via canary, rollback by reverting the
  tag.'` → `pr.type === 'release'`, `pr.rolloutPlan` equals that string.
- `generatePRDescription(..., 'hotfix/login-500')` with a malformed
  (non-JSON) mock response → `pr.type === 'release'`, `pr.rolloutPlan`
  equals the fixed fallback string, no throw (mirrors the existing
  "malformed LLM response" test for `summary`/`testing`).
- Existing 6 tests: update their `generatePRDescription(...)` calls to
  pass a 5th `branchName` argument (`'feat/foo'` is fine for all of
  them since none test type-specific behavior) — no assertion changes
  needed otherwise.

### 6. `src/integrations/antigravity/bridge.ts` (`handlePR`)

Confirmed (grepped) to call `generatePRDescription` with the exact same
shape as the Claude Code bridge (`src/integrations/antigravity/bridge.ts:206-218`).
Same change as item 4:

- Add `const currentBranch = await gitOps.getCurrentBranch();`.
- Pass `currentBranch` as the 5th argument to `generatePRDescription`.
- No other changes — `data: { baseBranch, prDescription }` already
  forwards the whole object.

## Test Plan (original)

1. `bun test tests/git/prDescription.test.ts` — new + updated cases pass.
2. `bun test` — full suite green (catches any other call site of
   `generatePRDescription` broken by the new required param, e.g. the
   antigravity bridge if it exists).
3. `bun run check:imports` — no new boundary violations (all changes stay
   within `git`/`cli`/`integrations`, consistent with existing layering).
4. `bun run build` — clean TypeScript compile.
5. Manual smoke test:
   - On a `fix/*` branch: `bun run src/cli.ts pr --base develop` → 4
     sections, no Rollout/Rollback Plan.
   - On a `release/*` or `hotfix/*` branch (create a throwaway one if
     needed): `bun run src/cli.ts pr --base main` → 5 sections including
     Rollout/Rollback Plan.

## Amendment: `feat/*` → its own `feature` type

### 1. `src/git/types.ts`

```ts
export type PRType = 'standard' | 'feature' | 'release';

export interface PRDescription {
  readonly type: PRType;
  readonly summary: string;
  readonly changes: readonly string[];
  readonly testing: string;
  readonly breakingChanges?: string;
  readonly rolloutNotes?: string; // present only when type === 'feature'
  readonly rolloutPlan?: string;  // present only when type === 'release'
}
```

### 2. `src/git/prDescription.ts`

- `detectPRType`: check `release/` / `hotfix/` first, then `feat/` →
  `'feature'`, else `'standard'`:
  ```ts
  export function detectPRType(branchName: string): PRType {
    if (branchName.startsWith('release/') || branchName.startsWith('hotfix/')) {
      return 'release';
    }
    if (branchName.startsWith('feat/')) {
      return 'feature';
    }
    return 'standard';
  }
  ```
- Add `FEATURE_PR_SYSTEM_PROMPT`: same JSON contract as
  `STANDARD_PR_SYSTEM_PROMPT` plus a required `rolloutNotes` field.
  Summary instruction tuned toward motivation/user-impact (e.g. "explain
  *why this capability exists and who benefits*, not just what changed").
  Rule text: "rolloutNotes: how this capability reaches users — is it
  behind a flag, rolled out gradually, does it need a docs update —
  required, never null."
- Prompt selection in `generatePRDescription` becomes a 3-way switch on
  `prType` (`'release'` → `RELEASE_PR_SYSTEM_PROMPT`, `'feature'` →
  `FEATURE_PR_SYSTEM_PROMPT`, else `STANDARD_PR_SYSTEM_PROMPT`).
- `LLMPRResponse` gains `rolloutNotes: string | null`; `parseLLMResponse`
  extracts it the same way as `rolloutPlan`.
- New fallback constant `ROLLOUT_NOTES_FALLBACK =
  'Rollout notes not generated — document manually before merging.'`.
- Return object: `rolloutNotes: prType === 'feature' ? (llmDescription.rolloutNotes
  ?? ROLLOUT_NOTES_FALLBACK) : undefined`, alongside the existing
  `rolloutPlan` line (which stays gated on `prType === 'release'` — the
  two are mutually exclusive since `prType` is a single value).

### 3. `src/cli.ts` (`handlePR`)

Add, alongside the existing release-only block:

```ts
if (pr.type === 'feature' && pr.rolloutNotes) {
  console.log(`## Rollout Notes\n${pr.rolloutNotes}\n`);
}
```

### 4. Bridges

No change needed — `src/integrations/claude-code/bridge.ts` and
`src/integrations/antigravity/bridge.ts` already forward the full
`prDescription` object; `rolloutNotes` reaches consumers automatically.

### 5. `tests/git/prDescription.test.ts`

- `detectPRType('feat/foo') === 'feature'` (update the existing
  `detectPRType` describe block — `'feat/foo'` currently asserts
  `'standard'` and must change to `'feature'`).
- New `generatePRDescription(..., 'feat/foo')` case with a mock response
  containing `rolloutNotes` → `pr.type === 'feature'`, `pr.rolloutNotes`
  equals the mock value, `pr.rolloutPlan === undefined`.
- New `generatePRDescription(..., 'feat/foo')` case with a malformed
  response → `pr.type === 'feature'`, `pr.rolloutNotes` equals
  `ROLLOUT_NOTES_FALLBACK`.
- Existing tests that pass `'feat/foo'` as the branch name for
  *type-agnostic* assertions (summary/testing/breakingChanges/fallback
  behavior) must switch to a genuinely `standard` branch name (e.g.
  `'chore/foo'`) so they keep testing `type: 'standard'` as originally
  intended — otherwise they'd now silently assert against `'feature'`
  behavior.

## Test Plan (amendment)

1. `bun test tests/git/prDescription.test.ts` — updated + new cases pass.
2. `bun test`, `bun run check:imports`, `bun run build` — full suite
   green.
3. Manual note: live CLI smoke test not possible in this environment (no
   LLM provider credentials configured) — same limitation as the
   original implementation; covered by unit tests with a mocked
   transport instead.
