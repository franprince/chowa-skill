import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPatchTargets,
  lex,
  redirectTargets,
  splitSegments,
  words,
} from '../scripts/lib/shell.mjs';

test('lex resolves single and double quotes into one word', () => {
  assert.deepEqual(
    lex(`echo "a b" 'c d'`).map((token) => token.value),
    ['echo', 'a b', 'c d'],
  );
});

test('lex marks quoted words so operators inside them stay inert', () => {
  const tokens = lex('echo "text > spec.md"');
  assert.equal(tokens.length, 2);
  assert.equal(tokens[1].quoted, true);
  assert.equal(tokens[1].operator, false);
  assert.equal(tokens[1].value, 'text > spec.md');
});

test('lex separates operators that abut their operands', () => {
  assert.deepEqual(
    lex('printf x >spec.md').map((token) => token.value),
    ['printf', 'x', '>', 'spec.md'],
  );
});

test('lex folds a file-descriptor number into the redirect operator', () => {
  assert.deepEqual(
    lex('cmd 2>&1').map((token) => token.value),
    ['cmd', '>&', '1'],
  );
});

test('lex honours backslash escapes', () => {
  assert.deepEqual(
    lex('touch spec\\ file.md').map((token) => token.value),
    ['touch', 'spec file.md'],
  );
});

test('splitSegments breaks on unquoted separators only', () => {
  assert.deepEqual(
    splitSegments('git add . && git commit -m "a; b" ; npm test').map((segment) => segment.text),
    ['git add .', 'git commit -m "a; b"', 'npm test'],
  );
});

test('splitSegments preserves the original text of each segment', () => {
  const [segment] = splitSegments('git   push   origin   main');
  assert.equal(segment.text, 'git   push   origin   main');
});

test('splitSegments splits pipelines and newlines', () => {
  assert.deepEqual(
    splitSegments('cat a.md | tee spec.md\nls').map((segment) => segment.text),
    ['cat a.md', 'tee spec.md', 'ls'],
  );
});

test('redirectTargets finds write redirects and ignores reads', () => {
  assert.deepEqual(redirectTargets(lex('cat in.md > out.md')), ['out.md']);
  assert.deepEqual(redirectTargets(lex('cat in.md >> out.md')), ['out.md']);
  assert.deepEqual(redirectTargets(lex('sort < in.md')), []);
});

test('redirectTargets ignores a redirect inside quotes', () => {
  assert.deepEqual(redirectTargets(lex('echo "a > b.md"')), []);
});

test('words drops operators and the filenames they consume', () => {
  assert.deepEqual(words(lex('echo hello > out.md')), ['echo', 'hello']);
});

test('applyPatchTargets reads every path an envelope writes', () => {
  const patch = [
    '*** Begin Patch',
    '*** Add File: spec.md',
    '+# Spec',
    '*** Update File: src/index.js',
    '*** Move to: docs/index.js',
    '*** Delete File: old.md',
    '*** End Patch',
  ].join('\n');

  assert.deepEqual(applyPatchTargets(patch), [
    'spec.md',
    'src/index.js',
    'docs/index.js',
    'old.md',
  ]);
});

test('applyPatchTargets is inert on ordinary commands', () => {
  assert.deepEqual(applyPatchTargets('git status'), []);
  assert.deepEqual(applyPatchTargets(undefined), []);
});
