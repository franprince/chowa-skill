import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../scripts/guard-push.mjs';

test('decide blocks direct push to main', () => {
  const result = decide('git push origin main', () => 'feat/my-branch');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /pushes directly to `main`/);
});

test('decide blocks direct push to master', () => {
  const result = decide('git push origin master', () => 'feat/my-branch');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /pushes directly to `master`/);
});

test('decide blocks git push with --all', () => {
  const result = decide('git push origin --all', () => 'feat/my-branch');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /pushes every branch/);
});

test('decide allows pushing feature branches', () => {
  const result = decide('git push origin feat/my-branch', () => 'feat/my-branch');
  assert.equal(result.blocked, false);
});

test('decide blocks pushing current branch if current branch is main', () => {
  const result = decide('git push', () => 'main');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /current branch, which is `main`/);
});

test('decide sees through git global flags that take a value', () => {
  // `-C` used to be swallowed by the generic "skip anything starting with -"
  // rule, so its *value* was read as the subcommand and the push sailed past.
  for (const command of [
    'git -C /repo push origin main',
    'git -c user.name=x push origin main',
    'git --git-dir=/r/.git push origin main',
    'git --work-tree /r push origin main',
  ]) {
    assert.equal(decide(command, () => 'feat/x').blocked, true, command);
  }
});

test('decide resolves HEAD to the branch it would actually write', () => {
  assert.equal(decide('git push origin HEAD', () => 'main').blocked, true);
  assert.equal(decide('git push origin @', () => 'master').blocked, true);
  assert.equal(decide('git push origin HEAD', () => 'feat/x').blocked, false);
});

test('decide is not fooled by a push mentioned inside a quoted string', () => {
  for (const command of [
    'echo "remember: git push origin main"',
    "git commit -m 'do not git push origin main'",
    'gh pr comment -b "git push origin main is forbidden"',
  ]) {
    assert.equal(decide(command, () => 'feat/x').blocked, false, command);
  }
});

test('decide still allows the release flow it exists to protect', () => {
  assert.equal(decide('git push origin release/v1.2.0', () => 'release/v1.2.0').blocked, false);
  assert.equal(decide('git push -u origin hotfix/leak', () => 'hotfix/leak').blocked, false);
  assert.equal(decide('git push origin HEAD:release/v1.2.0', () => 'main').blocked, false);
});

test('decide blocks a protected branch anywhere in a chained command', () => {
  const result = decide('npm test && git push origin main', () => 'feat/x');
  assert.equal(result.blocked, true);
  assert.equal(result.reason.startsWith('`git push origin main`'), true);
});

test('decide asks rather than denies, so the user can still approve', () => {
  assert.equal(decide('git push origin main', () => 'feat/x').decision, 'ask');
});

test('decide catches merges, which never invoke git push at all', () => {
  // The hole this closes: an agent can branch, PR, wait for green CI, and
  // merge its own pull request without a single `git push` to a protected
  // branch.
  for (const command of [
    'gh pr merge 11 --squash',
    'gh pr merge --auto --squash',
    'gh pr merge',
    'gh api repos/o/r/pulls/11/merge -X PUT',
    'gh api --method PUT repos/o/r/pulls/11/merge',
    'gh api repos/o/r/merges -f base=main -f head=feat/x',
  ]) {
    const result = decide(command, () => 'feat/x');
    assert.equal(result.blocked, true, command);
    assert.equal(result.decision, 'ask', command);
    assert.match(result.reason, /Landing code is the human's decision/, command);
  }
});

test('decide catches a local merge while a protected branch is checked out', () => {
  assert.equal(decide('git merge feat/x', () => 'main').blocked, true);
  assert.equal(decide('git -C /repo merge feat/x', () => 'master').blocked, true);
  assert.equal(decide('git merge develop', () => 'feat/x').blocked, false);
});

test('decide leaves non-landing gh and git commands alone', () => {
  for (const command of [
    'gh pr create --base main',
    'gh pr view 11 --json mergeable,mergeStateStatus',
    'gh pr checks 11',
    'gh api repos/o/r/pulls/11',
    'git merge-base main HEAD',
    'echo "gh pr merge 11"',
  ]) {
    assert.equal(decide(command, () => 'feat/x').blocked, false, command);
  }
});
