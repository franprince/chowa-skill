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
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
