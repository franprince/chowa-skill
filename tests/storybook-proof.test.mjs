import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveStoryFilesFromDiff,
  extractStoryIdsFromSource,
  classifyStories,
  buildComparisonTable,
} from '../scripts/storybook-proof.mjs';

test('resolveStoryFilesFromDiff includes a changed story file directly', () => {
  const changed = ['src/Button.stories.tsx'];
  const result = resolveStoryFilesFromDiff(changed, () => false);
  assert.deepEqual(result, ['src/Button.stories.tsx']);
});

test('resolveStoryFilesFromDiff resolves a component to its sibling story file when present', () => {
  const changed = ['src/Button.tsx'];
  const exists = (p) => p === 'src/Button.stories.tsx';
  const result = resolveStoryFilesFromDiff(changed, exists);
  assert.deepEqual(result, ['src/Button.stories.tsx']);
});

test('resolveStoryFilesFromDiff skips a component with no sibling story file', () => {
  const changed = ['src/util.ts'];
  const result = resolveStoryFilesFromDiff(changed, () => false);
  assert.deepEqual(result, []);
});

test('resolveStoryFilesFromDiff deduplicates resolutions', () => {
  const changed = ['src/Button.tsx', 'src/Button.stories.tsx'];
  const exists = (p) => p === 'src/Button.stories.tsx';
  const result = resolveStoryFilesFromDiff(changed, exists);
  assert.deepEqual(result, ['src/Button.stories.tsx']);
});

test('extractStoryIdsFromSource extracts IDs from title + named exports, skipping default', () => {
  const source = `
    export default { title: 'Forms/Button' };
    export const Primary = () => {};
    export const Secondary = () => {};
  `;
  const ids = extractStoryIdsFromSource(source);
  assert.deepEqual(ids, ['forms-button--primary', 'forms-button--secondary']);
});

test('extractStoryIdsFromSource returns no IDs when title is missing', () => {
  const source = `export const Primary = () => {};`;
  assert.deepEqual(extractStoryIdsFromSource(source), []);
});

test('classifyStories marks removed, changed, and new IDs correctly', () => {
  const result = classifyStories(['a', 'b'], ['b', 'c']);
  assert.deepEqual(result, [
    { id: 'a', status: 'removed' },
    { id: 'b', status: 'changed' },
    { id: 'c', status: 'new' },
  ]);
});

test('buildComparisonTable renders all four row states', () => {
  const table = buildComparisonTable([
    { id: 'forms-button--primary', status: 'changed', beforePath: 'before.png', afterPath: 'after.png' },
    { id: 'forms-modal--default', status: 'new', afterPath: 'after.png' },
    { id: 'forms-banner--default', status: 'removed', beforePath: 'before.png' },
    { id: 'forms-tooltip--hover', status: 'failed' },
  ]);

  assert.match(table, /\| Component \/ Story \| Before \| After \|/);
  assert.match(table, /\| `forms-button--primary` \| !\[Before\]\(before\.png\) \| !\[After\]\(after\.png\) \|/);
  assert.match(table, /\| `forms-modal--default` \| \*N\/A \(New Component\)\* \| !\[After\]\(after\.png\) \|/);
  assert.match(table, /\| `forms-banner--default` \| !\[Before\]\(before\.png\) \| \*N\/A \(Removed\)\* \|/);
  assert.match(table, /\| `forms-tooltip--hover` \| \*screenshot failed\* \| \*screenshot failed\* \|/);
});
