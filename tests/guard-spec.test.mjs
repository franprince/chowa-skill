import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRootSpecPath, isRootSpecBashCommand, decide } from '../scripts/guard-spec.mjs';

const mockCwd = '/home/user/project';

test('isRootSpecPath identifies root-level spec files', () => {
  assert.equal(isRootSpecPath('spec.md', mockCwd), true);
  assert.equal(isRootSpecPath('./spec.md', mockCwd), true);
  assert.equal(isRootSpecPath('implementation_plan.md', mockCwd), true);
  assert.equal(isRootSpecPath('./implementation_plan.md', mockCwd), true);
  assert.equal(isRootSpecPath('/home/user/project/spec.md', mockCwd), true);
  assert.equal(isRootSpecPath('/home/user/project/implementation_plan.md', mockCwd), true);
  assert.equal(isRootSpecPath('tasks.md', mockCwd), true);
  assert.equal(isRootSpecPath('./tasks.md', mockCwd), true);
  assert.equal(isRootSpecPath('/home/user/project/tasks.md', mockCwd), true);
});

test('isRootSpecPath allows per-feature spec paths under specs/', () => {
  assert.equal(isRootSpecPath('specs/2026-08-07-my-feature/spec.md', mockCwd), false);
  assert.equal(isRootSpecPath('specs/2026-08-07-my-feature/implementation_plan.md', mockCwd), false);
  assert.equal(isRootSpecPath('specs/2026-08-07-my-feature/tasks.md', mockCwd), false);
  assert.equal(isRootSpecPath('specs/INDEX.md', mockCwd), false);
  assert.equal(isRootSpecPath('src/main.ts', mockCwd), false);
});

test('isRootSpecBashCommand identifies commands outputting to root spec files', () => {
  assert.equal(isRootSpecBashCommand('echo "# Spec" > spec.md', mockCwd), true);
  assert.equal(isRootSpecBashCommand('cat plan.md >> implementation_plan.md', mockCwd), true);
  assert.equal(isRootSpecBashCommand('touch spec.md', mockCwd), true);
  assert.equal(isRootSpecBashCommand('cp foo.md ./implementation_plan.md', mockCwd), true);
  assert.equal(isRootSpecBashCommand('touch tasks.md', mockCwd), true);
  assert.equal(isRootSpecBashCommand('echo "- [ ] task" > tasks.md', mockCwd), true);
});

test('isRootSpecBashCommand allows normal bash commands and specs/ paths', () => {
  assert.equal(isRootSpecBashCommand('echo "# Spec" > specs/2026-08-07-feat/spec.md', mockCwd), false);
  assert.equal(isRootSpecBashCommand('git status', mockCwd), false);
  assert.equal(isRootSpecBashCommand('npm test', mockCwd), false);
});

test('decide blocks tool calls attempting to write root spec files', () => {
  const result = decide('Write', { file_path: 'spec.md' }, mockCwd);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /prohibited/);

  const bashResult = decide('Bash', { command: 'echo "hello" > implementation_plan.md' }, mockCwd);
  assert.equal(bashResult.blocked, true);
  assert.match(bashResult.reason, /root-level spec file/);
});

test('decide allows tool calls writing inside specs/ directory for feature iteration', () => {
  const specResult = decide('Write', { file_path: 'specs/2026-08-07-feature-auth/spec.md' }, mockCwd);
  assert.equal(specResult.blocked, false);

  const planResult = decide('Edit', { file_path: 'specs/2026-08-07-feature-auth/implementation_plan.md' }, mockCwd);
  assert.equal(planResult.blocked, false);

  const tasksResult = decide('Write', { file_path: 'specs/2026-08-07-feature-auth/tasks.md' }, mockCwd);
  assert.equal(tasksResult.blocked, false);

  const indexResult = decide('Write', { file_path: 'specs/INDEX.md' }, mockCwd);
  assert.equal(indexResult.blocked, false);
});

test('decide blocks tool calls attempting to write root-level tasks.md', () => {
  const result = decide('Write', { file_path: 'tasks.md' }, mockCwd);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /prohibited/);
});
