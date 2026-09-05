#!/usr/bin/env node
/**
 * Generate the skill and its on-demand references from the shared template.
 * Variant selection remains compatible with chowa's sibling renderer; only
 * this generator extracts reference blocks from the selected content.
 *
 * Usage:
 *   node scripts/generate-skill.mjs          # write all generated artifacts
 *   node scripts/generate-skill.mjs --check  # detect stale or missing artifacts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isDirectRun } from './lib/direct-run.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const TEMPLATE = join(repoRoot, 'templates/chowa-workflow.md');
export const GENERATED_SKILL = join(repoRoot, 'skills/chowa-skill/SKILL.md');

const FRONTMATTER = `---
name: chowa-skill
description: >
  Spec-driven development with durable plans, atomic Conventional Commits,
  PR preparation and readiness checks, and bounded mechanical delegation.
  Use for new features, specs, implementation plans, implementing approved
  work, commits, PRs, mechanical delegation, or requested roadmap views.
  Check project or user opt-in before applying the workflow; otherwise
  follow repository conventions.
---`;

const VALID_TAGS = new Set(['shared', 'chowa-only', 'chowa-skill-only']);
const SAFE_REFERENCE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Track Markdown fences, including longer fences and tilde fences. */
function nextFence(line, fence) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (!match) return fence;
  const [, delimiter, suffix] = match;
  if (fence) {
    return delimiter[0] === fence.character && delimiter.length >= fence.length && !suffix.trim()
      ? null
      : fence;
  }
  if (delimiter[0] === '`' && suffix.includes('`')) return null;
  return { character: delimiter[0], length: delimiter.length };
}

function marker(line, kind) {
  if (!new RegExp(`<!--\\s*${kind}\\s*:`).test(line)) return null;
  const match = line.match(new RegExp(`^\\s*<!-- ${kind}:([^\\s]+) -->\\s*$`));
  if (!match) throw new Error(`Malformed ${kind} marker: ${line.trim()}`);
  return match[1];
}

/** Select variants without interpreting reference markers. */
export function selectVariants(template, keptTags = ['shared', 'chowa-skill-only']) {
  const kept = new Set(keptTags);
  const lines = [];
  let active = null;
  let started = false;
  let fence = null;

  for (const line of template.split(/\r?\n/)) {
    const tag = fence ? null : marker(line, 'variant');
    if (tag !== null) {
      if (tag === 'end') {
        if (active === null) throw new Error('Unmatched variant end marker.');
        active = null;
      } else {
        if (!VALID_TAGS.has(tag)) throw new Error(`Unrecognized variant tag "${tag}".`);
        if (active !== null) throw new Error(`Nested variant marker "${tag}" inside "${active}".`);
        active = tag;
        started = true;
      }
      continue;
    }
    fence = nextFence(line, fence);
    if (started && (active === null || kept.has(active))) lines.push(line);
  }

  if (active !== null) throw new Error(`Unmatched variant start marker "${active}".`);
  if (!started) throw new Error('Template has no variant blocks.');
  return lines.join('\n');
}

/** Collapse prose spacing and number main-document headings, preserving code. */
function formatMarkdown(markdown, numberHeadings = false) {
  let fence = null;
  let heading = 0;
  let previousBlank = false;
  const lines = [];
  for (const line of markdown.split('\n')) {
    const wasFenced = fence !== null;
    fence = nextFence(line, fence);
    if (wasFenced || fence) {
      lines.push(line);
      previousBlank = false;
      continue;
    }
    if (!line.trim()) {
      if (!previousBlank) lines.push('');
      previousBlank = true;
      continue;
    }
    previousBlank = false;
    lines.push(numberHeadings ? line.replace(/^### (.+)$/, (_, title) => `### ${++heading}. ${title}`) : line);
  }
  return lines.join('\n').trim();
}

/** Extract on-demand references after selecting this skill's variants. */
export function renderSkill(template) {
  const body = [];
  const references = {};
  let active = null;
  let referenceLines = [];
  let fence = null;

  for (const line of selectVariants(template).split('\n')) {
    const name = fence ? null : marker(line, 'reference');
    if (name !== null) {
      if (name === 'end') {
        if (active === null) throw new Error('Unmatched reference end marker.');
        references[active] = `${formatMarkdown(referenceLines.join('\n'))}\n`;
        active = null;
        referenceLines = [];
      } else {
        if (!SAFE_REFERENCE_NAME.test(name)) throw new Error(`Unsafe reference name "${name}".`);
        if (active !== null) throw new Error(`Nested reference marker "${name}" inside "${active}".`);
        if (Object.hasOwn(references, name)) throw new Error(`Duplicate reference name "${name}".`);
        active = name;
      }
      continue;
    }
    fence = nextFence(line, fence);
    (active === null ? body : referenceLines).push(line);
  }

  if (active !== null) throw new Error(`Unmatched reference start marker "${active}".`);
  return { body: formatMarkdown(body.join('\n'), true), references };
}

/** Preserve the original API for callers that only need the main body. */
export function renderTemplate(template) {
  return renderSkill(template).body;
}

/** Build an explicit output set; files outside it are never removed. */
export function generatedArtifacts(template, skillPath = GENERATED_SKILL) {
  const { body, references } = renderSkill(template);
  return new Map([
    [skillPath, `${FRONTMATTER}\n\n${body}\n`],
    ...Object.entries(references).map(([name, content]) => [
      join(dirname(skillPath), 'references', `${name}.md`), content,
    ]),
  ]);
}

export function checkGeneratedArtifacts(artifacts) {
  const issues = [];
  for (const [path, expected] of artifacts) {
    try {
      if (readFileSync(path, 'utf-8') !== expected) issues.push(`${path} is out of date with the template.`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      issues.push(`${path} is missing.`);
    }
  }
  return issues;
}

export function writeGeneratedArtifacts(artifacts) {
  for (const [path, content] of artifacts) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf-8');
  }
}

function main() {
  try {
    const artifacts = generatedArtifacts(readFileSync(TEMPLATE, 'utf-8'));
    if (process.argv.includes('--check')) {
      const issues = checkGeneratedArtifacts(artifacts);
      if (issues.length) {
        console.error(`${issues.join('\n')}\nRun: node scripts/generate-skill.mjs`);
        process.exitCode = 1;
        return;
      }
      console.log(`Generated skill and ${artifacts.size - 1} reference(s) are in sync with the template.`);
      return;
    }
    writeGeneratedArtifacts(artifacts);
    console.log(`Wrote the skill and ${artifacts.size - 1} reference(s) from the template.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (isDirectRun(import.meta.url)) main();
