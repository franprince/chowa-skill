import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyBump, bumpSemver } from '../scripts/bump-version.mjs';

test('classifyBump: a plain feat commit is minor', () => {
  assert.equal(classifyBump(['feat(cli): add new flag']), 'minor');
});

test('classifyBump: a plain fix commit is patch', () => {
  assert.equal(classifyBump(['fix(router): correct fallback order']), 'patch');
});

test('classifyBump: a bang after the type is major', () => {
  assert.equal(classifyBump(['feat!: drop legacy config format']), 'major');
});

test('classifyBump: a BREAKING CHANGE footer is major even on a fix', () => {
  const message = 'fix(core): correct default\n\nBREAKING CHANGE: default changed from A to B';
  assert.equal(classifyBump([message]), 'major');
});

test('classifyBump: only docs/chore commits produce no bump', () => {
  assert.equal(classifyBump(['docs(readme): fix typo', 'chore: bump devDeps']), 'none');
});

test('classifyBump: no commits produces no bump', () => {
  assert.equal(classifyBump([]), 'none');
});

test('classifyBump: major beats minor beats patch across a mixed batch', () => {
  const messages = ['fix(core): patch it', 'feat(core): add it', 'feat!: break it'];
  assert.equal(classifyBump(messages), 'major');
});

test('classifyBump: minor beats patch when both are present without a break', () => {
  const messages = ['fix(core): patch it', 'feat(core): add it'];
  assert.equal(classifyBump(messages), 'minor');
});

test('bumpSemver: patch increments the last component', () => {
  assert.equal(bumpSemver('1.2.3', 'patch'), '1.2.4');
});

test('bumpSemver: minor increments and resets patch', () => {
  assert.equal(bumpSemver('1.2.3', 'minor'), '1.3.0');
});

test('bumpSemver: major increments and resets minor and patch', () => {
  assert.equal(bumpSemver('1.2.3', 'major'), '2.0.0');
});
