#!/usr/bin/env node
/**
 * Version bumping
 *
 * Computes the next `.claude-plugin/plugin.json` version from Conventional
 * Commit types accumulated since the latest git tag, following standard
 * semantic-release precedence: a `BREAKING CHANGE:` footer or `type!:`
 * subject wins as major, else any `feat:` is minor, else any `fix:` is
 * patch, else nothing changes.
 *
 * Usage:
 *   node scripts/bump-version.mjs   # bump plugin.json if warranted
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isDirectRun } from './lib/direct-run.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN_MANIFEST = join(repoRoot, '.claude-plugin/plugin.json');

const BREAKING_FOOTER = /BREAKING CHANGE:/;
const CONVENTIONAL_SUBJECT = /^(\w+)(\([^)]*\))?(!)?:/m;

/**
 * @param {string[]} commitMessages full "subject\n\nbody" text per commit
 * @returns {'major' | 'minor' | 'patch' | 'none'}
 */
export function classifyBump(commitMessages) {
  let level = 'none';
  for (const message of commitMessages) {
    const match = message.match(CONVENTIONAL_SUBJECT);
    if (!match) continue;
    const [, type, , breakingBang] = match;
    if (breakingBang || BREAKING_FOOTER.test(message)) return 'major';
    if (type === 'feat' && level !== 'minor') level = 'minor';
    if (type === 'fix' && level === 'none') level = 'patch';
  }
  return level;
}

/**
 * @param {string} current e.g. "0.2.0"
 * @param {'major' | 'minor' | 'patch'} level
 */
export function bumpSemver(current, level) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function commitsSinceLastTag() {
  const lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
    cwd: repoRoot,
    encoding: 'utf-8',
  }).trim();
  const separator = '\x1e';
  const log = execFileSync(
    'git',
    ['log', `${lastTag}..HEAD`, `--pretty=format:%B${separator}`],
    { cwd: repoRoot, encoding: 'utf-8' },
  );
  return log.split(separator).map((entry) => entry.trim()).filter(Boolean);
}

function writeOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    writeFileSync(outputFile, `${name}=${value}\n`, { flag: 'a' });
  }
}

function main() {
  const level = classifyBump(commitsSinceLastTag());
  if (level === 'none') {
    console.log('No feat/fix/breaking commits since the last tag — no version bump.');
    writeOutput('bumped', 'false');
    return;
  }

  const manifest = JSON.parse(readFileSync(PLUGIN_MANIFEST, 'utf-8'));
  const previousVersion = manifest.version;
  const nextVersion = bumpSemver(previousVersion, level);
  manifest.version = nextVersion;
  writeFileSync(PLUGIN_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  console.log(`${level}: ${previousVersion} -> ${nextVersion}`);
  writeOutput('bumped', 'true');
  writeOutput('version', nextVersion);
}

if (isDirectRun(import.meta.url)) {
  main();
}
