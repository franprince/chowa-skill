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
