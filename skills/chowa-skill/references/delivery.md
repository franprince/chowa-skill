# Commits and pull requests

Use this procedure for requested or already authorized commit/PR work, and for
branch setup when preparing implementation. A standalone delivery request does
not trigger spec creation or a refinement offer. Read only the current diff,
relevant history, and applicable project instructions.

## Branching and PR Workflow

- Use a topic branch for changes. Reuse the branch for the current task;
  create one for a new task. Preserve unrelated working-tree changes.
- Follow repository branch conventions. By default, branch from and target
  `develop` when it exists. Release/hotfix branches target the default branch;
  hotfixes may start there for a live incident. Otherwise, topic branches
  start from and target the repository's default branch (`main` or `master`).
- Before starting branch work, fetch the relevant remote and inspect branch
  status. Recheck before publishing; reconcile divergence before claiming
  readiness. Report unavailable remote checks without inventing freshness.
- When PR preparation is within scope, create or update it if requested or
  already authorized. Otherwise, prepare its title/body and ask once before
  publishing it. Authorization to create a PR does not itself authorize
  merging it.
- Use `gh pr create` / `gh pr edit`. Check mergeability with
  `gh pr view <n> --json mergeable,mergeStateStatus` and required checks with
  `gh pr checks <n>`. Resolve base conflicts on the topic branch, verify,
  and push within the authorized scope. Pending, unknown, or failing checks
  must be reported accurately; they do not establish readiness.

## Commits and Verification

Inspect `git status`, the working diff, and the staged diff. Group commits
by logical change, keeping implementation/tests and linked documentation
together. Write commit messages directly in the primary session.

Use Conventional Commits: `type(scope): imperative description`, following
repository types and scope conventions. Run the project's required
checks appropriate to the change before committing. Reuse passing results
while the relevant code and environment are unchanged; rerun affected checks
after fixes. Report skipped checks and unresolved failures.

## PR Descriptions

Read `git log <base>..HEAD` and `git diff <base>...HEAD`, then write the PR
description directly.

Describe the resulting behavior, material changes, and verification. Include
a rollout/rollback plan for releases or hotfixes where relevant. End the PR
description with this footer, replacing any default assistant attribution:

```text
調和 (Chōwa) — spec → plan → execute, verified before merge
```

Experimental visual proof is enabled only by an explicit user request or a
standing project instruction. UI file extensions alone do not enable it.

When enabled, read [Visual proof](visual-proof.md). Run the
Storybook collector only when specifically requested for a Storybook UI.
