import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HARNESSES, install, loadSnippet, mergeHooks } from '../scripts/install-hooks.mjs';

/** The definitions a snippet carries, whichever shape the harness uses. */
function definitionsOf(snippet, harness) {
  return harness.hookName ? snippet[harness.hookName][harness.event] : snippet.hooks[harness.event];
}

test('every supported harness ships a snippet for its own event', () => {
  for (const [name, harness] of Object.entries(HARNESSES)) {
    const definitions = definitionsOf(loadSnippet(harness.snippet, '/opt/chowa'), harness);
    assert.ok(Array.isArray(definitions) && definitions.length > 0, name);
    assert.match(definitions[0].hooks[0].command, /guard\.mjs/, name);
    assert.match(definitions[0].hooks[0].command, new RegExp(`--harness ${name}`), name);
  }
});

test('the antigravity snippet uses its top-level named shape', () => {
  const snippet = loadSnippet(HARNESSES.antigravity.snippet, '/opt/chowa');
  assert.equal(snippet.hooks, undefined);
  assert.ok(Array.isArray(snippet['chowa-guards'].PreToolUse));
  assert.match(
    snippet['chowa-guards'].PreToolUse[0].matcher,
    /run_command\|write_to_file\|replace_file_content/,
  );
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

  const merged = mergeHooks(existing, snippet, HARNESSES.claude);
  assert.equal(merged.hooks.PreToolUse.length, 2);
  assert.equal(merged.hooks.PreToolUse[0].hooks[0].command, 'their-linter');
});

test('mergeHooks replaces our own entry instead of stacking duplicates', () => {
  const snippet = loadSnippet(HARNESSES.claude.snippet, '/opt/chowa');
  const once = mergeHooks({}, snippet, HARNESSES.claude);
  const twice = mergeHooks(once, snippet, HARNESSES.claude);
  const thrice = mergeHooks(twice, loadSnippet(HARNESSES.claude.snippet, '/new/path'), HARNESSES.claude);

  assert.equal(once.hooks.PreToolUse.length, 1);
  assert.deepEqual(twice, once);
  assert.equal(thrice.hooks.PreToolUse.length, 1);
  assert.match(thrice.hooks.PreToolUse[0].hooks[0].command, /\/new\/path/);
});

test('mergeHooks does not mutate the configuration it was given', () => {
  const existing = { hooks: { PreToolUse: [] }, otherSetting: true };
  const before = JSON.stringify(existing);
  mergeHooks(existing, loadSnippet(HARNESSES.claude.snippet, '/opt/chowa'), HARNESSES.claude);
  assert.equal(JSON.stringify(existing), before);
});

test('mergeHooks preserves unrelated settings in the file', () => {
  const merged = mergeHooks(
    { theme: 'dark', hooks: { SessionStart: [{ matcher: '*', hooks: [] }] } },
    loadSnippet(HARNESSES.gemini.snippet, '/opt/chowa'),
    HARNESSES.gemini,
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

test('installing for antigravity writes its named entry to .agents/hooks.json', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'chowa-install-'));
  const first = install('antigravity', { scope: 'project', cwd });

  assert.equal(first.configPath, join(cwd, '.agents', 'hooks.json'));
  const written = JSON.parse(readFileSync(first.configPath, 'utf-8'));
  assert.ok(Array.isArray(written['chowa-guards'].PreToolUse));

  assert.equal(install('antigravity', { scope: 'project', cwd }).changed, false);
});

test('the antigravity merge leaves other named hooks alone', () => {
  const merged = mergeHooks(
    { 'their-linter': { PostToolUse: [{ matcher: '*', hooks: [] }] } },
    loadSnippet(HARNESSES.antigravity.snippet, '/opt/chowa'),
    HARNESSES.antigravity,
  );

  assert.ok(merged['their-linter'].PostToolUse);
  assert.ok(merged['chowa-guards'].PreToolUse);
});
