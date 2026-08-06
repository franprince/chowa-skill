import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderTemplate, TEMPLATE, GENERATED_SKILL } from '../scripts/generate-skill.mjs';

test('keeps shared and chowa-skill-only content, drops chowa-only', () => {
  const template = [
    '<!-- variant:shared -->',
    'shared line',
    '<!-- variant:end -->',
    '<!-- variant:chowa-only -->',
    'chowa-only line',
    '<!-- variant:end -->',
    '<!-- variant:chowa-skill-only -->',
    'chowa-skill-only line',
    '<!-- variant:end -->',
  ].join('\n');

  const rendered = renderTemplate(template);

  assert.match(rendered, /shared line/);
  assert.match(rendered, /chowa-skill-only line/);
  assert.doesNotMatch(rendered, /chowa-only line/);
});

test('numbers ### headings sequentially in document order', () => {
  const template = [
    '<!-- variant:shared -->',
    '### First',
    'a',
    '<!-- variant:end -->',
    '<!-- variant:chowa-only -->',
    '### Dropped',
    'b',
    '<!-- variant:end -->',
    '<!-- variant:chowa-skill-only -->',
    '### Second',
    'c',
    '<!-- variant:end -->',
  ].join('\n');

  const rendered = renderTemplate(template);

  assert.match(rendered, /### 1\. First/);
  assert.match(rendered, /### 2\. Second/);
  assert.doesNotMatch(rendered, /Dropped/);
});

test('throws on an unrecognized variant tag', () => {
  const template = '<!-- variant:bogus -->\nx\n<!-- variant:end -->';

  assert.throws(() => renderTemplate(template), /Unrecognized variant tag/);
});

test('throws on unmatched variant markers', () => {
  const template = '<!-- variant:shared -->\nx\n<!-- variant:shared -->\ny\n<!-- variant:end -->';

  assert.throws(() => renderTemplate(template), /Unmatched variant markers/);
});

test('the committed generated skill matches what the template produces', () => {
  // Same guarantee CI enforces via --check, kept here so a local
  // `node --test` catches drift too.
  const template = readFileSync(TEMPLATE, 'utf-8');
  const expectedBody = renderTemplate(template);
  const committed = readFileSync(GENERATED_SKILL, 'utf-8');

  assert.ok(
    committed.includes(expectedBody),
    'generated SKILL.md does not contain the current template render — run `node scripts/generate-skill.mjs`',
  );
});
