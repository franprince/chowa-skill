import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { alwaysOn, guardsDisabled, isOptedIn } from '../scripts/lib/opt-in.mjs';

/** A preferences path that does not exist, so a real one can't leak in. */
const NO_PREFERENCES = join(tmpdir(), 'chowa-no-such-preferences.json');
const options = { preferencesPath: NO_PREFERENCES };

function project(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'chowa-opt-in-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

test('a project with a spec index has opted in', () => {
  assert.equal(isOptedIn(project({ 'specs/INDEX.md': '# Spec Index' }), options), true);
});

test('a project with a chowa config has opted in', () => {
  assert.equal(isOptedIn(project({ 'chowa.config.js': 'module.exports = {}' }), options), true);
});

test('an unrelated project has not', () => {
  assert.equal(isOptedIn(project({ 'package.json': '{}' }), options), false);
});

test('opt-in is detected from a subdirectory of the project', () => {
  const root = project({ 'specs/INDEX.md': '# Spec Index' });
  mkdirSync(join(root, 'src', 'deep'), { recursive: true });
  assert.equal(isOptedIn(join(root, 'src', 'deep'), options), true);
});

test('the walk stops at the repository root rather than escaping upward', () => {
  const outer = project({ 'specs/INDEX.md': '# Spec Index' });
  const inner = join(outer, 'vendor', 'unrelated');
  mkdirSync(join(inner, '.git'), { recursive: true });
  assert.equal(isOptedIn(inner, options), false);
});

test('an always-on preference opts every project in', () => {
  const root = project({ 'preferences.json': JSON.stringify({ alwaysOn: true }) });
  const preferencesPath = join(root, 'preferences.json');

  assert.equal(alwaysOn(preferencesPath), true);
  assert.equal(isOptedIn(project({ 'package.json': '{}' }), { preferencesPath }), true);
});

test('missing or malformed preferences read as off', () => {
  assert.equal(alwaysOn(NO_PREFERENCES), false);
  const root = project({ 'preferences.json': 'not json' });
  assert.equal(alwaysOn(join(root, 'preferences.json')), false);
});

test('isOptedIn tolerates a missing cwd', () => {
  assert.equal(isOptedIn(undefined, options), false);
  assert.equal(isOptedIn('', options), false);
});

test('guardsDisabled recognizes the documented off switches', () => {
  for (const value of ['off', 'OFF', '0', 'false']) {
    assert.equal(guardsDisabled({ CHOWA_GUARDS: value }), true, value);
  }
  assert.equal(guardsDisabled({}), false);
  assert.equal(guardsDisabled({ CHOWA_GUARDS: 'on' }), false);
});
