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
