import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../skills/chowa-skill/', import.meta.url));

test('an isolated skill installs and executes every primary host adapter', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'chowa-standalone-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // These characters must remain literal when the host launches the command.
  const skill = join(root, "skill space ' $literal `echo injected`");
  const project = join(root, 'project');
  cpSync(source, skill, { recursive: true });
  mkdirSync(join(project, 'specs'), { recursive: true });
  mkdirSync(join(project, 'subdir'));
  writeFileSync(join(project, 'specs/INDEX.md'), '# Index\n');
  const cases = [
    ['claude', '.claude/settings.json', 'PreToolUse', 'Bash', 'ask'],
    ['codex', '.codex/hooks.json', 'PreToolUse', 'Bash', 'deny'],
    ['gemini', '.gemini/settings.json', 'BeforeTool', 'run_shell_command', 'deny'],
  ];
  for (const [host, settings, event, shell, pushDecision] of cases) {
    const installArgs = [join(skill, 'scripts/install-hooks.mjs'), '--harness', host, '--scope', 'project'];
    execFileSync(process.execPath, installArgs, { cwd: project });
    const first = readFileSync(join(project, settings), 'utf8');
    execFileSync(process.execPath, installArgs, { cwd: project });
    assert.equal(readFileSync(join(project, settings), 'utf8'), first, host);
    const definition = JSON.parse(first).hooks[event][0];
    const matcher = new RegExp(definition.matcher);
    assert.ok(matcher.test(shell), host);
    if (host === 'claude') assert.ok(matcher.test('PowerShell'));
    const command = definition.hooks[0].command;
    assert.ok(command.includes(root), 'installed command must use the isolated copy');
    const run = (tool_name, tool_input) => {
      const output = execSync(command, {
        cwd: project, encoding: 'utf8',
        input: JSON.stringify({ session_id: 's1', tool_use_id: 'u1',
          ...(host === 'codex' ? { turn_id: 't1' } : {}),
          hook_event_name: event, cwd: project, tool_name, tool_input }),
      });
      if (!output) return undefined;
      const result = JSON.parse(output);
      return result.hookSpecificOutput?.permissionDecision ?? result.decision;
    };
    assert.equal(run(shell, { command: 'git push origin main' }), pushDecision, host);
    assert.equal(run(shell, { command: 'git status' }), undefined, host);
    const write = host === 'codex' ? 'apply_patch' : host === 'gemini' ? 'write_file' : 'Write';
    assert.ok(matcher.test(write), host);
    const input = (path) => host === 'codex'
      ? { command: `*** Begin Patch\n*** Add File: ${path}\n+# Spec\n*** End Patch` }
      : { file_path: join(project, path), content: '# Spec' };
    assert.equal(run(write, input('spec.md')), 'deny', host);
    assert.equal(run(write, input('specs/2026-09-05-example/spec.md')), undefined, host);
    if (host === 'gemini') {
      assert.equal(run(shell, { command: 'touch ../spec.md', dir_path: 'subdir' }), 'deny');
      assert.equal(run(shell, { command: 'touch spec.md', dir_path: 'subdir' }), undefined);
    }
  }
  assert.equal(existsSync(join(root, 'scripts')), false, 'no repository-root helpers exist');
});
