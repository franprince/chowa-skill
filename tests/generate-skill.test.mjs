import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  checkGeneratedArtifacts, generatedArtifacts, renderSkill, renderTemplate,
  RUNTIME_FILES, TEMPLATE, writeGeneratedArtifacts,
} from '../scripts/generate-skill.mjs';

const block = (body) => body;
const reference = (name, body = `# ${name}\n\nReference content.`) =>
  `<!-- reference:${name} -->\n${body}\n<!-- reference:end -->`;

test('render numbers main headings and extracts reference headings unchanged', () => {
  const template = ['### First\nShared content.', reference('hooks', '# Hooks\n### Reference heading'), '### Second\nSkill content.'].join('\n');
  const { body, references } = renderSkill(template);
  assert.equal(body, '### 1. First\nShared content.\n### 2. Second\nSkill content.');
  assert.deepEqual(references, { hooks: '# Hooks\n### Reference heading\n' });
  assert.equal(renderTemplate(template), body);
});

test('render preserves marker examples, headings, and blank lines inside Markdown fences', () => {
  for (const [opening, closing] of [['```markdown', '```'], ['~~~~markdown', '~~~~'], ['````markdown', '````']]) {
    const code = [
      opening, '### Example', '<!-- reference:fake -->', '<!-- reference:end -->',
      '', '',
      ...(opening === '```markdown' ? [] : ['```']), closing,
    ].join('\n');
    const { body, references } = renderSkill(block(`### First\n${code}\n### Second`));
    assert.equal(body, `### 1. First\n${code}\n### 2. Second`);
    assert.deepEqual(references, {});
  }
});

test('render preserves fenced examples inside extracted references', () => {
  const content = '# Hooks\n\n~~~md\n<!-- reference:end -->\n### Example\n~~~';
  const { references } = renderSkill(block(reference('hooks', content)));
  assert.equal(references.hooks, `${content}\n`);
});

test('render rejects malformed, unsafe, duplicate, nested, and unmatched reference markers', () => {
  for (const [content, message] of [
    ['<!-- reference:hooks-->\nx\n<!-- reference:end -->', /Malformed reference marker/],
    ['<!--reference:hooks -->\nx\n<!-- reference:end -->', /Malformed reference marker/],
    [reference('../hooks'), /Unsafe reference name/],
    [reference('nested/hooks'), /Unsafe reference name/],
    [reference('__proto__'), /Unsafe reference name/],
    [`${reference('hooks')}\n${reference('hooks')}`, /Duplicate reference name/],
    [reference('hooks', reference('other')), /Nested reference marker/],
    ['<!-- reference:hooks -->\nx', /Unmatched reference start/],
    ['<!-- reference:end -->', /Unmatched reference end/],
  ]) assert.throws(() => renderSkill(block(content)), message);
});

test('artifact checks detect stale and missing references as well as the main skill', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'chowa-skill-generator-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const skill = join(dir, 'SKILL.md');
  const hooks = join(dir, 'references/hooks.md');
  const artifacts = generatedArtifacts(block(`# Skill\n${reference('hooks')}`), skill);
  assert.equal(artifacts.size, 2 + RUNTIME_FILES.length);
  assert.equal(checkGeneratedArtifacts(artifacts).length, artifacts.size);

  writeGeneratedArtifacts(artifacts);
  assert.deepEqual(checkGeneratedArtifacts(artifacts), []);
  writeFileSync(hooks, 'Stale reference.');
  assert.deepEqual(checkGeneratedArtifacts(artifacts), [`${hooks} is out of date with its source.`]);
  unlinkSync(hooks);
  assert.deepEqual(checkGeneratedArtifacts(artifacts), [`${hooks} is missing.`]);
  writeGeneratedArtifacts(artifacts);
  writeFileSync(skill, 'Stale skill.');
  assert.deepEqual(checkGeneratedArtifacts(artifacts), [`${skill} is out of date with its source.`]);

  const unowned = join(dir, 'references/personal.md');
  writeFileSync(unowned, 'User-owned reference.');
  writeGeneratedArtifacts(artifacts);
  assert.equal(readFileSync(unowned, 'utf-8'), 'User-owned reference.');
  assert.deepEqual(checkGeneratedArtifacts(artifacts), []);
});

test('template exposes every generated reference through a resolvable main-body link', () => {
  const { body, references } = renderSkill(readFileSync(TEMPLATE, 'utf-8'));
  assert.deepEqual(Object.keys(references).sort(), ['hooks', 'roadmap', 'simplified-english', 'visual-proof']);
  const linked = [...body.matchAll(/\]\(references\/([a-z0-9-]+)\.md\)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(linked)].sort(), Object.keys(references).sort());
  for (const content of Object.values(references)) {
    assert.match(content, /^# /);
    assert.ok(content.endsWith('\n'));
  }
});

test('template generated artifacts are in sync and the entrypoint stays within its size budget', () => {
  const artifacts = generatedArtifacts(readFileSync(TEMPLATE, 'utf-8'));
  assert.deepEqual(checkGeneratedArtifacts(artifacts), [], 'Run: node scripts/generate-skill.mjs');
  assert.ok([...artifacts.values()][0].length <= 12_000, 'Keep the main skill below 12,000 characters.');
});
