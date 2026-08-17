import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HARNESSES, install, loadSnippet, mergeHooks } from '../scripts/install-hooks.mjs';

test('every supported harness ships a snippet for its own event', () => {
  for (const [name, harness] of Object.entries(HARNESSES)) {
    const snippet = loadSnippet(harness.snippet, '/opt/chowa');
    const definitions = snippet.hooks[harness.event];
    assert.ok(Array.isArray(definitions) && definitions.length > 0, name);
    assert.match(definitions[0].hooks[0].command, /guard\.mjs/, name);
    assert.match(definitions[0].hooks[0].command, /--harness/, name);
  }
});

test('loadSnippet substitutes the checkout path into the command', () => {
  const snippet = loadSnippet(HARNESSES.gemini.snippet, '/opt/chowa');
  const { command } = snippet.hooks.BeforeTool[0].hooks[0];
  assert.match(command, /\/opt\/chowa\/scripts\/guard\.mjs/);
  assert.doesNotMatch(command, /__CHOWA_SKILL_ROOT__/);
});

test('loadSnippet expands the plugin-root variable for a manual install', () => {
  const snippet = loadSnippet(HARNESSES.claude.snippet, '/opt/chowa');
  const { command } = snippet.hooks.PreToolUse[0].hooks[0];
  assert.doesNotMatch(command, /CLAUDE_PLUGIN_ROOT/);
  assert.match(command, /\/opt\/chowa/);
});

test('mergeHooks keeps hooks that belong to someone else', () => {
  const existing = {
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'their-linter' }] }],
    },
  };
  const snippet = loadSnippet(HARNESSES.claude.snippet, '/opt/chowa');

  const merged = mergeHooks(existing, snippet, 'PreToolUse');
  assert.equal(merged.hooks.PreToolUse.length, 2);
  assert.equal(merged.hooks.PreToolUse[0].hooks[0].command, 'their-linter');
});

test('mergeHooks replaces our own entry instead of stacking duplicates', () => {
  const snippet = loadSnippet(HARNESSES.claude.snippet, '/opt/chowa');
  const once = mergeHooks({}, snippet, 'PreToolUse');
  const twice = mergeHooks(once, snippet, 'PreToolUse');
  const thrice = mergeHooks(twice, loadSnippet(HARNESSES.claude.snippet, '/new/path'), 'PreToolUse');

  assert.equal(once.hooks.PreToolUse.length, 1);
  assert.deepEqual(twice, once);
  assert.equal(thrice.hooks.PreToolUse.length, 1);
  assert.match(thrice.hooks.PreToolUse[0].hooks[0].command, /\/new\/path/);
});

test('mergeHooks does not mutate the configuration it was given', () => {
  const existing = { hooks: { PreToolUse: [] }, otherSetting: true };
  const before = JSON.stringify(existing);
  mergeHooks(existing, loadSnippet(HARNESSES.claude.snippet, '/opt/chowa'), 'PreToolUse');
  assert.equal(JSON.stringify(existing), before);
});

test('mergeHooks preserves unrelated settings in the file', () => {
  const merged = mergeHooks(
    { theme: 'dark', hooks: { SessionStart: [{ matcher: '*', hooks: [] }] } },
    loadSnippet(HARNESSES.gemini.snippet, '/opt/chowa'),
    'BeforeTool',
  );
  assert.equal(merged.theme, 'dark');
  assert.equal(merged.hooks.SessionStart.length, 1);
  assert.equal(merged.hooks.BeforeTool.length, 1);
});

test('install --dry-run reports what it would write without writing it', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'chowa-install-'));
  const { configPath, content, changed } = install('gemini', {
    scope: 'project',
    cwd,
    dryRun: true,
  });

  assert.equal(configPath, join(cwd, '.gemini', 'settings.json'));
  assert.equal(changed, true);
  assert.match(content, /BeforeTool/);
  assert.throws(() => readFileSync(configPath, 'utf-8'), { code: 'ENOENT' });
});

test('install writes, then reports no change on a second run', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'chowa-install-'));

  const first = install('codex', { scope: 'project', cwd });
  assert.equal(first.changed, true);
  assert.equal(JSON.parse(readFileSync(first.configPath, 'utf-8')).hooks.PreToolUse.length, 1);

  const second = install('codex', { scope: 'project', cwd });
  assert.equal(second.changed, false);
  assert.equal(JSON.parse(readFileSync(second.configPath, 'utf-8')).hooks.PreToolUse.length, 1);
});

test('install refuses a configuration file it cannot parse', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'chowa-install-'));
  mkdirSync(join(cwd, '.codex'), { recursive: true });
  writeFileSync(join(cwd, '.codex', 'hooks.json'), '{ not json');

  assert.throws(() => install('codex', { scope: 'project', cwd }), /not valid JSON/);
});

test('install rejects an unknown harness by name', () => {
  assert.throws(() => install('emacs'), /Unknown harness "emacs"/);
});
