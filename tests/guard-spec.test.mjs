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

test('isRootSpecBashCommand catches in-place edits and moves', () => {
  for (const command of [
    'sed -i s/a/b/ spec.md',
    'sed -i.bak s/a/b/ tasks.md',
    'git mv notes.md spec.md',
    'dd if=/dev/null of=spec.md',
    'printf "x" >spec.md',
    'cat a.md | tee implementation_plan.md',
  ]) {
    assert.equal(isRootSpecBashCommand(command, mockCwd), true, command);
  }
});

test('isRootSpecBashCommand does not fire on a spec path inside a quoted string', () => {
  // The old regex matched `> spec.md` anywhere in the line, so printing a
  // sentence about specs was blocked. Blocking legitimate work is the worse
  // failure mode of the two.
  for (const command of [
    'echo "write it to > spec.md later"',
    "git commit -m 'docs: move spec.md into specs/'",
    'grep -r "spec.md" .',
  ]) {
    assert.equal(isRootSpecBashCommand(command, mockCwd), false, command);
  }
});

test('isRootSpecBashCommand leaves reads and moves-away alone', () => {
  assert.equal(isRootSpecBashCommand('cat spec.md', mockCwd), false);
  assert.equal(isRootSpecBashCommand('sed s/a/b/ spec.md', mockCwd), false);
  assert.equal(isRootSpecBashCommand('mv spec.md specs/2026-08-17-x/spec.md', mockCwd), false);
});

test('decide reads apply_patch envelopes, the only file write Codex exposes', () => {
  const patch = '*** Begin Patch\n*** Add File: spec.md\n+# Spec\n*** End Patch';
  const result = decide('apply_patch', { command: patch }, mockCwd);
  assert.equal(result.blocked, true);
  assert.match(result.reason, /patch writes root-level `spec.md`/);

  const allowed = '*** Begin Patch\n*** Add File: specs/2026-08-17-x/spec.md\n+# Spec\n*** End Patch';
  assert.equal(decide('apply_patch', { command: allowed }, mockCwd).blocked, false);
});

test('decide covers the path key each harness uses', () => {
  for (const key of ['file_path', 'notebook_path', 'path', 'absolute_path']) {
    assert.equal(decide('Write', { [key]: 'spec.md' }, mockCwd).blocked, true, key);
  }
});

test('decide denies rather than asks, since the agent can fix it itself', () => {
  assert.equal(decide('Write', { file_path: 'spec.md' }, mockCwd).decision, 'deny');
});

const shell = (command, cwd = mockCwd, projectRoot = mockCwd) =>
  decide('Bash', { command }, cwd, projectRoot).blocked;

test('decide resolves a write against the directory an earlier cd moved to', () => {
  for (const command of [
    'cd specs/2026-08-07-feat && touch spec.md',
    'cd specs/2026-08-07-feat && cat > tasks.md <<EOF\n- [ ] one\nEOF',
    'cd src && echo x > spec.md',
    'pushd specs/2026-08-07-feat; touch implementation_plan.md',
  ]) {
    assert.equal(shell(command), false, command);
  }
});

test('decide blocks a root spec write reached by moving up to the root', () => {
  assert.equal(shell('cd .. && touch spec.md', `${mockCwd}/src`), true);
  assert.equal(shell('cd src && cd .. && touch spec.md'), true);
});

test('decide ends a subshell directory change at its closing parenthesis', () => {
  for (const command of [
    '(cd specs/2026-08-07-feat && echo "done"); touch spec.md',
    '(cd src && touch notes.md) && touch spec.md',
    '(touch spec.md)',
  ]) {
    assert.equal(shell(command), true, command);
  }
  assert.equal(shell('(cd specs/2026-08-07-feat && touch spec.md)'), false);
});

test('decide defers a relative write from a directory it cannot resolve', () => {
  assert.equal(shell('cd "$DIR" && touch spec.md'), false);
  assert.equal(shell(`cd "$DIR" && touch ${mockCwd}/spec.md`), true);
});

test('decide ignores a heredoc body that only mentions a root spec file', () => {
  assert.equal(shell('cat > notes.txt <<EOF\necho draft > spec.md\nEOF'), false);
  assert.equal(shell('cat > spec.md <<EOF\n# Spec\nEOF'), true);
});

test('decide quotes only the start of a very long command', () => {
  const result = decide('Bash', { command: `touch spec.md ${'x'.repeat(5000)}` }, mockCwd);
  assert.equal(result.blocked, true);
  assert.ok(result.reason.length < 600, `reason is ${result.reason.length} characters`);
});

/** A tracking predicate that knows the given absolute paths, as git would. */
const tracking = (...paths) => (absolutePath) => paths.includes(absolutePath);
const verdict = (toolName, toolInput, isTracked, cwd = mockCwd) =>
  decide(toolName, toolInput, cwd, mockCwd, isTracked).blocked;

test('decide allows a root spec file that git already tracks, on every write path', () => {
  const isTracked = tracking(`${mockCwd}/spec.md`);
  const patch = '*** Begin Patch\n*** Update File: spec.md\n@@\n-a\n+b\n*** End Patch';

  assert.equal(verdict('Edit', { file_path: 'spec.md' }, isTracked), false);
  assert.equal(verdict('Write', { file_path: `${mockCwd}/spec.md` }, isTracked), false);
  assert.equal(verdict('apply_patch', { command: patch }, isTracked), false);
  assert.equal(verdict('Bash', { command: 'sed -i s/a/b/ spec.md' }, isTracked), false);
  assert.equal(verdict('Bash', { command: 'echo x >> ./spec.md' }, isTracked), false);
});

test('decide still denies an untracked root spec file beside a tracked one', () => {
  const isTracked = tracking(`${mockCwd}/spec.md`);
  const patch =
    '*** Begin Patch\n*** Update File: spec.md\n@@\n-a\n+b\n*** Add File: tasks.md\n+- [ ] one\n*** End Patch';

  assert.equal(verdict('Write', { file_path: 'tasks.md' }, isTracked), true);
  assert.equal(verdict('apply_patch', { command: patch }, isTracked), true);
  assert.equal(verdict('Bash', { command: 'touch spec.md tasks.md' }, isTracked), true);
  assert.equal(verdict('Bash', { command: 'sed -i s/a/b/ spec.md && touch tasks.md' }, isTracked), true);
});

test('decide asks about tracking with the path as written, from where the command runs', () => {
  const isTracked = tracking(`${mockCwd}/SPEC.md`);

  assert.equal(verdict('Edit', { file_path: 'SPEC.md' }, isTracked), false);
  assert.equal(verdict('Edit', { file_path: 'spec.md' }, isTracked), true);
  assert.equal(verdict('Bash', { command: 'cd src && cd .. && sed -i s/a/b/ SPEC.md' }, isTracked), false);
  assert.equal(verdict('Bash', { command: 'sed -i s/a/b/ ../SPEC.md' }, isTracked, `${mockCwd}/src`), false);
  assert.equal(verdict('Bash', { command: `cd "$DIR" && touch ${mockCwd}/SPEC.md` }, isTracked), false);
});

test('decide consults tracking only for a root spec path', () => {
  const asked = [];
  const isTracked = (absolutePath) => {
    asked.push(absolutePath);
    return false;
  };

  verdict('Write', { file_path: 'src/index.js' }, isTracked);
  verdict('Write', { file_path: 'specs/2026-08-07-feat/spec.md' }, isTracked);
  verdict('Bash', { command: 'cd specs/2026-08-07-feat && touch spec.md && npm test' }, isTracked);
  assert.deepEqual(asked, []);
});
