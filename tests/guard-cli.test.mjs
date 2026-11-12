/**
 * Process-level hook contract tests.
 *
 * Every other test file imports `decide()` and checks the policy. That left
 * the layer where the script is actually *invoked* — stdin parsed, dialect
 * resolved, verdict serialized, entry point reached — with no coverage at
 * all, which is how `guard-spec.mjs` shipped a direct-run check that made
 * it a silent no-op whenever it was reached through a symlink or from a
 * path containing non-ASCII characters. Exit 0, no output: identical to
 * "allowed", and invisible to CI.
 *
 * These tests spawn the real script the way a harness does.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = join(repoRoot, 'scripts/guard.mjs');

/** A project that opts in, so the spec guard applies. */
function optedInProject() {
  const root = mkdtempSync(join(tmpdir(), 'chowa-project-'));
  mkdirSync(join(root, 'specs'), { recursive: true });
  writeFileSync(join(root, 'specs', 'INDEX.md'), '# Spec Index\n');
  return root;
}

/**
 * Run a guard script the way a harness does: payload on stdin, verdict on
 * stdout, exit code as the out-of-band signal.
 */
function runGuard(payload, { script = GUARD, args = [], env = {} } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      input: JSON.stringify(payload),
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (error) {
    return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', status: error.status };
  }
}

const pushToMain = (cwd) => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: 'Bash',
  tool_input: { command: 'git push origin main' },
});

const writeRootSpec = (cwd) => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: 'Write',
  tool_input: { file_path: 'spec.md' },
});

test('the dispatcher denies a root-level spec write, invoked as a harness would', () => {
  const cwd = optedInProject();
  const { stdout, status } = runGuard(writeRootSpec(cwd), { args: ['--harness', 'claude'] });

  assert.equal(status, 0);
  const { hookSpecificOutput } = JSON.parse(stdout);
  assert.equal(hookSpecificOutput.permissionDecision, 'deny');
  assert.match(hookSpecificOutput.permissionDecisionReason, /specs\/<YYYY-MM-DD>-<slug>/);
});

test('the dispatcher asks before pushing to a protected branch', () => {
  const cwd = optedInProject();
  const { stdout } = runGuard(pushToMain(cwd), { args: ['--harness', 'claude'] });

  const { hookSpecificOutput } = JSON.parse(stdout);
  assert.equal(hookSpecificOutput.permissionDecision, 'ask');
  assert.match(hookSpecificOutput.permissionDecisionReason, /pushes directly to `main`/);
});

test('the dispatcher stays silent on an ordinary command', () => {
  const cwd = optedInProject();
  const { stdout, status } = runGuard(
    { hook_event_name: 'PreToolUse', cwd, tool_name: 'Bash', tool_input: { command: 'npm test' } },
    { args: ['--harness', 'claude'] },
  );

  assert.equal(status, 0);
  assert.equal(stdout, '');
});

// --- The failure that had no coverage -------------------------------------

test('guards still decide when invoked through a symlink', () => {
  const cwd = optedInProject();
  const linkDirectory = mkdtempSync(join(tmpdir(), 'chowa-link-'));
  const link = join(linkDirectory, 'guard.mjs');
  symlinkSync(GUARD, link);

  const { stdout } = runGuard(writeRootSpec(cwd), { script: link, args: ['--harness', 'claude'] });
  assert.match(stdout, /"permissionDecision":"deny"/);
});

test('guards still decide from a path containing non-ASCII characters', () => {
  const cwd = optedInProject();
  // A user whose home directory carries an accent, or an install path
  // spelled `chōwa`, used to silently disarm the spec guard forever.
  const root = join(mkdtempSync(join(tmpdir(), 'chowa-utf8-')), 'chōwa plügin');
  cpSync(join(repoRoot, 'scripts'), join(root, 'scripts'), { recursive: true });

  const { stdout } = runGuard(writeRootSpec(cwd), {
    script: join(root, 'scripts/guard.mjs'),
    args: ['--harness', 'claude'],
  });
  assert.match(stdout, /"permissionDecision":"deny"/);
});

test('each guard also decides when run on its own, not just via the dispatcher', () => {
  const cwd = optedInProject();

  const spec = runGuard(writeRootSpec(cwd), {
    script: join(repoRoot, 'scripts/guard-spec.mjs'),
    args: ['--harness', 'claude'],
  });
  assert.match(spec.stdout, /"permissionDecision":"deny"/);

  const push = runGuard(pushToMain(cwd), {
    script: join(repoRoot, 'scripts/guard-push.mjs'),
    args: ['--harness', 'claude'],
  });
  assert.match(push.stdout, /"permissionDecision":"ask"/);
});

// --- Context along the command line ----------------------------------------

/** A real repository checked out on `branch`, with `main` behind it. */
function repositoryOn(branch) {
  const root = mkdtempSync(join(tmpdir(), 'chowa-repo-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'init');
  if (branch !== 'main') git('checkout', '-q', '-b', branch);
  return root;
}

const shellCall = (cwd, command) => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: 'Bash',
  tool_input: { command },
});

test('the dispatcher judges a push by the branch the command line switches to', () => {
  const cwd = repositoryOn('feat/x');

  const plain = runGuard(shellCall(cwd, 'git push'), { args: ['--harness', 'claude'] });
  assert.equal(plain.stdout, '');

  const switched = runGuard(shellCall(cwd, 'git checkout main && git merge feat/x && git push'), {
    args: ['--harness', 'claude'],
  });
  assert.match(switched.stdout, /"permissionDecision":"ask"/);
});

test('the dispatcher reads the branch of the repository a push runs in', () => {
  const onMain = repositoryOn('main');
  const onTopic = repositoryOn('feat/x');

  const elsewhere = runGuard(shellCall(onMain, `git -C ${onTopic} push`), { args: ['--harness', 'claude'] });
  assert.equal(elsewhere.stdout, '');

  const entered = runGuard(shellCall(onTopic, `cd ${onMain} && git push`), { args: ['--harness', 'claude'] });
  assert.match(entered.stdout, /"permissionDecision":"ask"/);
});

test('the dispatcher allows a spec written after cd into its feature directory', () => {
  const cwd = optedInProject();
  const { stdout, status } = runGuard(
    shellCall(cwd, 'cd specs/2026-08-07-feat && cat > spec.md <<EOF\n# Spec\nEOF'),
    { args: ['--harness', 'claude'] },
  );

  assert.equal(status, 0);
  assert.equal(stdout, '');
});

/** An opted-in repository with `tracked` committed at its root. */
function optedInRepositoryTracking(tracked) {
  const root = repositoryOn('feat/x');
  mkdirSync(join(root, 'specs'), { recursive: true });
  writeFileSync(join(root, 'specs', 'INDEX.md'), '# Spec Index\n');
  writeFileSync(join(root, tracked), '# Project specification\n');
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('add', '--', tracked);
  git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'docs: add spec');
  return root;
}

const editFile = (cwd, filePath) => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: 'Edit',
  tool_input: { file_path: filePath, old_string: 'a', new_string: 'b' },
});

test('the dispatcher allows edits to a root spec file that git already tracks', () => {
  const cwd = optedInRepositoryTracking('SPEC.md');
  const options = { args: ['--harness', 'claude'] };

  assert.equal(runGuard(editFile(cwd, 'SPEC.md'), options).stdout, '');
  assert.equal(runGuard(editFile(cwd, join(cwd, 'SPEC.md')), options).stdout, '');
  assert.equal(runGuard(shellCall(cwd, 'sed -i s/a/b/ SPEC.md'), options).stdout, '');
  assert.equal(runGuard(shellCall(join(cwd, 'specs'), 'echo x >> ../SPEC.md'), options).stdout, '');
});

test('the dispatcher still denies a new root spec file in a repository that tracks another', () => {
  const cwd = optedInRepositoryTracking('SPEC.md');
  const options = { args: ['--harness', 'claude'] };

  assert.match(runGuard(editFile(cwd, 'tasks.md'), options).stdout, /"permissionDecision":"deny"/);
  assert.match(runGuard(shellCall(cwd, 'touch tasks.md'), options).stdout, /"permissionDecision":"deny"/);
});

test('the dispatcher denies a root spec file that exists but git does not track', () => {
  const cwd = optedInRepositoryTracking('SPEC.md');
  writeFileSync(join(cwd, 'tasks.md'), '- [ ] one\n');

  const { stdout } = runGuard(editFile(cwd, 'tasks.md'), { args: ['--harness', 'claude'] });
  assert.match(stdout, /"permissionDecision":"deny"/);
});

test('emit delivers output larger than a pipe buffer in full', () => {
  const harness = pathToFileURL(join(repoRoot, 'scripts/lib/harness.mjs')).href;
  const script =
    `import { emit } from ${JSON.stringify(harness)};` +
    "emit({ blocked: true }, { render: () => ({ stdout: 'x'.repeat(300000), stderr: 'e'.repeat(300000), exitCode: 2 }) });";
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf-8' });

  assert.equal(run.stdout.length, 300000);
  assert.equal(run.stderr.length, 300000);
  assert.equal(run.status, 2);
});

// --- Cross-harness --------------------------------------------------------

test('gemini gets its own payload shape in and its own schema out', () => {
  const cwd = optedInProject();
  const { stdout, status } = runGuard(
    {
      hook_event_name: 'BeforeTool',
      cwd,
      tool_name: 'write_file',
      tool_input: { file_path: 'spec.md', content: '# Spec' },
    },
    { args: ['--harness', 'gemini'] },
  );

  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.decision, 'deny');
  assert.match(parsed.reason, /prohibited/);
});

test('gemini shell payloads reach the push guard under its own tool name', () => {
  const cwd = optedInProject();
  const { stdout } = runGuard(
    {
      hook_event_name: 'BeforeTool',
      cwd,
      tool_name: 'run_shell_command',
      tool_input: { command: 'git push origin main' },
    },
    { args: ['--harness', 'gemini'] },
  );

  assert.equal(JSON.parse(stdout).decision, 'deny'); // gemini cannot ask
});

test('codex apply_patch envelopes are read for spec paths', () => {
  const cwd = optedInProject();
  const { stdout } = runGuard(
    {
      hook_event_name: 'PreToolUse',
      cwd,
      turn_id: 't1',
      tool_use_id: 'u1',
      tool_name: 'apply_patch',
      tool_input: {
        command: '*** Begin Patch\n*** Add File: spec.md\n+# Spec\n*** End Patch',
      },
    },
    { args: ['--harness', 'codex'] },
  );

  const { hookSpecificOutput } = JSON.parse(stdout);
  assert.equal(hookSpecificOutput.permissionDecision, 'deny');
  assert.match(hookSpecificOutput.permissionDecisionReason, /patch writes root-level/);
});

test('codex never receives ask, since it cannot route one to the user', () => {
  const cwd = optedInProject();
  const { stdout } = runGuard(
    { ...pushToMain(cwd), turn_id: 't1', tool_use_id: 'u1' },
    { args: ['--harness', 'codex'] },
  );
  assert.equal(JSON.parse(stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('antigravity payloads decide, and it is the one other harness that can ask', () => {
  const cwd = optedInProject();

  const write = runGuard(
    {
      toolCall: { name: 'write_to_file', args: { TargetFile: 'spec.md', CodeContent: '# Spec' } },
      workspacePaths: [cwd],
    },
    { args: ['--harness', 'antigravity'] },
  );
  assert.equal(JSON.parse(write.stdout).decision, 'deny');

  const push = runGuard(
    {
      toolCall: { name: 'run_command', args: { CommandLine: 'git push origin main', Cwd: cwd } },
      workspacePaths: [cwd],
    },
    { args: ['--harness', 'antigravity'] },
  );
  assert.equal(JSON.parse(push.stdout).decision, 'ask');
});

test('antigravity gets no decision at all when nothing is wrong', () => {
  const cwd = optedInProject();
  const { stdout, status } = runGuard(
    {
      toolCall: { name: 'run_command', args: { CommandLine: 'npm test', Cwd: cwd } },
      workspacePaths: [cwd],
    },
    { args: ['--harness', 'antigravity'] },
  );

  assert.equal(status, 0);
  assert.deepEqual(JSON.parse(stdout), {}); // never `{"decision":"allow"}`
});

test('an undeclared harness blocks via exit 2 and stderr', () => {
  const cwd = optedInProject();
  const { stderr, status } = runGuard({
    cwd,
    tool_name: 'some_write_tool',
    tool_input: { file_path: 'spec.md' },
  });

  assert.equal(status, 2);
  assert.match(stderr, /prohibited/);
});

// --- Scope and escape hatch ------------------------------------------------

test('the spec guard says nothing in a project that never opted in', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'chowa-unrelated-'));
  writeFileSync(join(cwd, 'package.json'), '{}');

  const { stdout, status } = runGuard(writeRootSpec(cwd), {
    args: ['--harness', 'claude'],
    // Neutralize a real always-on preference on the machine running these.
    env: { HOME: cwd },
  });

  assert.equal(status, 0);
  assert.equal(stdout, '');
});

test('the push guard applies even where the spec convention does not', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'chowa-unrelated-'));
  const { stdout } = runGuard(pushToMain(cwd), {
    args: ['--harness', 'claude'],
    env: { HOME: cwd },
  });

  assert.match(stdout, /"permissionDecision":"ask"/);
});

test('CHOWA_GUARDS=off disables both guards', () => {
  const cwd = optedInProject();

  for (const payload of [writeRootSpec(cwd), pushToMain(cwd)]) {
    const { stdout, status } = runGuard(payload, {
      args: ['--harness', 'claude'],
      env: { CHOWA_GUARDS: 'off' },
    });
    assert.equal(status, 0);
    assert.equal(stdout, '');
  }
});

test('a malformed payload defers rather than blocking', () => {
  const stdout = execFileSync(process.execPath, [GUARD, '--harness', 'claude'], {
    input: 'not json at all',
    encoding: 'utf-8',
  });

  assert.equal(stdout, '');
});
