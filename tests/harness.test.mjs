import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIALECTS, normalize, resolveDialect } from '../scripts/lib/harness.mjs';

/** Payloads shaped the way each harness actually sends them. */
const PAYLOADS = {
  claude: {
    session_id: 's1',
    cwd: '/home/user/project',
    hook_event_name: 'PreToolUse',
    permission_mode: 'default',
    tool_name: 'Bash',
    tool_input: { command: 'git push origin main' },
  },
  codex: {
    session_id: 's1',
    cwd: '/home/user/project',
    hook_event_name: 'PreToolUse',
    turn_id: 't1',
    tool_use_id: 'u1',
    tool_name: 'Bash',
    tool_input: { command: 'git push origin main' },
  },
  gemini: {
    session_id: 's1',
    cwd: '/home/user/project',
    hook_event_name: 'BeforeTool',
    timestamp: '2026-08-17T00:00:00Z',
    tool_name: 'run_shell_command',
    tool_input: { command: 'git push origin main' },
  },
  antigravity: {
    // Nested tool call, PascalCase arguments, no `cwd` of its own.
    toolCall: { name: 'run_command', args: { CommandLine: 'git push origin main', Cwd: '/home/user/project' } },
    stepIdx: 19,
    conversationId: 'c1',
    workspacePaths: ['/home/user/project'],
    transcriptPath: '/tmp/t.json',
  },
};

test('resolveDialect prefers the harness declared on the command line', () => {
  assert.equal(
    resolveDialect({ argv: ['--harness', 'gemini'], payload: PAYLOADS.claude }).id,
    'gemini',
  );
  assert.equal(
    resolveDialect({ argv: ['--harness=codex'], payload: PAYLOADS.claude }).id,
    'codex',
  );
});

test('resolveDialect falls back to the environment, then to the payload', () => {
  assert.equal(resolveDialect({ env: { CHOWA_HARNESS: 'codex' }, payload: {} }).id, 'codex');
  assert.equal(resolveDialect({ payload: PAYLOADS.claude }).id, 'claude');
  assert.equal(resolveDialect({ payload: PAYLOADS.codex }).id, 'codex');
  assert.equal(resolveDialect({ payload: PAYLOADS.gemini }).id, 'gemini');
  assert.equal(resolveDialect({ payload: PAYLOADS.antigravity }).id, 'antigravity');
});

test('a nested tool call identifies antigravity without an event name', () => {
  // Its payload carries no `hook_event_name` at all, so the nesting is the
  // only signal — and it is unambiguous.
  assert.equal(resolveDialect({ payload: { toolCall: { name: 'run_command', args: {} } } }).id, 'antigravity');
});

test('resolveDialect ignores an unknown declared harness', () => {
  assert.equal(resolveDialect({ argv: ['--harness', 'nope'], payload: PAYLOADS.gemini }).id, 'gemini');
});

test('resolveDialect returns generic for an unrecognized payload', () => {
  assert.equal(resolveDialect({ payload: { tool_name: 'Bash' } }).id, 'generic');
  assert.equal(resolveDialect({}).id, 'generic');
});

test('normalize produces the same request from every harness', () => {
  const requests = Object.entries(PAYLOADS).map(([id, payload]) =>
    normalize(payload, DIALECTS[id]),
  );

  for (const request of requests) {
    assert.equal(request.command, 'git push origin main');
    assert.equal(request.cwd, '/home/user/project');
    assert.equal(request.isShellTool, true);
    assert.deepEqual(request.filePaths, []);
  }
});

test('normalize collects file paths from every harness key', () => {
  const cases = [
    ['Write', { file_path: 'spec.md' }],
    ['NotebookEdit', { notebook_path: 'spec.md' }],
    ['write_file', { file_path: 'spec.md' }],
    ['replace', { file_path: 'spec.md', old_string: 'a', new_string: 'b' }],
  ];

  for (const [tool_name, tool_input] of cases) {
    const request = normalize(
      { hook_event_name: 'PreToolUse', cwd: '/p', tool_name, tool_input },
      DIALECTS.claude,
    );
    assert.deepEqual(request.filePaths, ['spec.md'], tool_name);
    assert.equal(request.isWriteTool, true, tool_name);
  }
});

test("normalize resolves Gemini's shell directory against the session cwd", () => {
  const request = normalize(
    {
      hook_event_name: 'BeforeTool',
      cwd: '/home/user/project',
      tool_name: 'run_shell_command',
      tool_input: { command: 'touch spec.md', directory: 'packages/api' },
    },
    DIALECTS.gemini,
  );
  assert.equal(request.cwd, '/home/user/project/packages/api');
});

test('normalize treats an unknown tool carrying a command as a shell tool', () => {
  const request = normalize(
    { tool_name: 'exec_command', tool_input: { command: 'git push origin main' }, cwd: '/p' },
    DIALECTS.generic,
  );
  assert.equal(request.isShellTool, true);
  assert.equal(request.command, 'git push origin main');
});

const BLOCKED = { blocked: true, decision: 'ask', reason: 'Nope.' };

test('claude renders a permission decision and can ask', () => {
  const { stdout, exitCode } = DIALECTS.claude.render(BLOCKED);
  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(stdout), {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: 'Nope.',
    },
  });
});

test('codex shares the schema but downgrades ask to deny', () => {
  const { stdout } = DIALECTS.codex.render(BLOCKED);
  assert.equal(JSON.parse(stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('normalize reads antigravity PascalCase write arguments', () => {
  const request = normalize(
    {
      toolCall: { name: 'write_to_file', args: { TargetFile: 'spec.md', CodeContent: '# Spec' } },
      workspacePaths: ['/home/user/project'],
    },
    DIALECTS.antigravity,
  );

  assert.deepEqual(request.filePaths, ['spec.md']);
  assert.equal(request.isWriteTool, true);
  assert.equal(request.cwd, '/home/user/project');
});

test('antigravity can ask, and never auto-allows on no opinion', () => {
  const asked = JSON.parse(DIALECTS.antigravity.render(BLOCKED).stdout);
  assert.equal(asked.decision, 'ask');
  assert.equal(asked.reason, 'Nope.');

  const denied = JSON.parse(
    DIALECTS.antigravity.render({ blocked: true, decision: 'deny', reason: 'No.' }).stdout,
  );
  assert.equal(denied.decision, 'deny');

  // `allow` would auto-approve calls the user would otherwise be prompted
  // about; a guard must never widen permissions.
  const quiet = JSON.parse(DIALECTS.antigravity.render({ blocked: false }).stdout);
  assert.equal(quiet.decision, undefined);
});

test('gemini renders its own decision schema', () => {
  const { stdout, exitCode } = DIALECTS.gemini.render(BLOCKED);
  assert.equal(exitCode, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.decision, 'deny');
  assert.equal(parsed.reason, 'Nope.');
  // Matched loosely on purpose: the prefix contains characters whose
  // Unicode normalization differs between editors, and asserting on the
  // exact bytes would fail for a reason that has nothing to do with hooks.
  assert.match(parsed.systemMessage, /guard: Nope\.$/);
});

test('an unknown harness still blocks, via exit 2 and stderr', () => {
  const { stdout, stderr, exitCode } = DIALECTS.generic.render(BLOCKED);
  assert.equal(exitCode, 2);
  assert.equal(stdout, '');
  assert.equal(stderr, 'Nope.');
});

test('every dialect stays silent when nothing is blocked', () => {
  for (const dialect of Object.values(DIALECTS)) {
    const { stderr, exitCode } = dialect.render({ blocked: false });
    assert.equal(exitCode, 0, dialect.id);
    assert.equal(stderr, '', dialect.id);
  }
  // Gemini's docs require JSON on stdout, so it gets an explicit no-opinion.
  assert.equal(DIALECTS.gemini.render({ blocked: false }).stdout, '{}');
  assert.equal(DIALECTS.antigravity.render({ blocked: false }).stdout, '{}');
  assert.equal(DIALECTS.claude.render({ blocked: false }).stdout, '');
});
