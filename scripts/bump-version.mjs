#!/usr/bin/env node
/**
 * Version bumping
 *
 * Computes the next `.claude-plugin/plugin.json` version from Conventional
 * Commit types accumulated since the verified current release, following standard
 * semantic-release precedence: a `BREAKING CHANGE:` footer or `type!:`
 * subject wins as major, else any `feat:` is minor, else any `fix:` is
 * patch, else nothing changes.
 *
 * Usage:
 *   node scripts/bump-version.mjs   # bump plugin.json if warranted
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isDirectRun } from './lib/direct-run.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN_MANIFEST = join(repoRoot, '.claude-plugin/plugin.json');

const BREAKING_FOOTER = /^BREAKING(?: CHANGE|-CHANGE):[ \t]+\S/m;
const CONVENTIONAL_SUBJECT = /^(\w+)(\([^)]*\))?(!)?:[ \t]+\S/;
const MANIFEST_PATH = '.claude-plugin/plugin.json';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function validateVersion(version) {
  if (typeof version !== 'string' || !VERSION.test(version)) {
    throw new Error(`Invalid release version: ${JSON.stringify(version)}.`);
  }
  if (!version.split('.').every((part) => Number.isSafeInteger(Number(part)))) {
    throw new Error(`Release version exceeds safe numeric limits: ${version}.`);
  }
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function versionAt(ref, cwd) {
  return JSON.parse(git(['show', `${ref}:${MANIFEST_PATH}`], cwd)).version;
}

/** Use the exact version tag, or recover a verified historical release commit. */
export function findReleaseBase(version, cwd = repoRoot) {
  validateVersion(version);
  const tag = `v${version}`;
  const tagRef = `refs/tags/${tag}`;
  const exists = spawnSync('git', ['show-ref', '--verify', '--quiet', tagRef], { cwd });
  if (exists.status === 0) {
    const sha = git(['rev-parse', `${tagRef}^{commit}`], cwd);
    git(['merge-base', '--is-ancestor', sha, 'HEAD'], cwd);
    if (versionAt(sha, cwd) !== version) throw new Error(`Tag ${tag} does not match its manifest version.`);
    return { tag, sha, restoreTag: false };
  }
  if (exists.status !== 1) throw new Error('Cannot inspect release tags.');

  // Older workflows pushed release commits but omitted their lightweight tags.
  const subject = `chore(release): v${version} [skip ci]`;
  const entry = git(['log', '--first-parent', '--format=%H%x09%s', 'HEAD'], cwd)
    .split('\n').find((line) => line.slice(line.indexOf('\t') + 1) === subject);
  if (!entry) throw new Error(`No verified release boundary for ${tag}; restore the correct release tag before retrying.`);
  const sha = entry.split('\t')[0];
  if (versionAt(sha, cwd) !== version || versionAt(`${sha}^`, cwd) === version) {
    throw new Error(`Release commit ${sha} does not establish version ${version}.`);
  }
  return { tag, sha, restoreTag: true };
}

/**
 * @param {string[]} commitMessages full "subject\n\nbody" text per commit
 * @returns {'major' | 'minor' | 'patch' | 'none'}
 */
export function classifyBump(commitMessages) {
  let level = 'none';
  for (const message of commitMessages) {
    const subject = message.split(/\r?\n/, 1)[0];
    const match = subject.match(CONVENTIONAL_SUBJECT);
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
  validateVersion(current);
  const [major, minor, patch] = current.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown version bump: ${level}.`);
}

export function commitsSinceRelease(base, cwd = repoRoot) {
  const separator = '\x1e';
  return git(['log', `${base.sha}..HEAD`, `--pretty=format:%B${separator}`], cwd)
    .split(separator).map((entry) => entry.trim()).filter(Boolean);
}

function writeOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    writeFileSync(outputFile, `${name}=${value}\n`, { flag: 'a' });
  }
}

function main() {
  const manifest = JSON.parse(readFileSync(PLUGIN_MANIFEST, 'utf-8'));
  const previousVersion = manifest.version;
  const base = findReleaseBase(previousVersion);
  const level = classifyBump(commitsSinceRelease(base));
  writeOutput('base_tag', base.tag);
  writeOutput('base_sha', base.sha);
  writeOutput('restore_base_tag', String(base.restoreTag));
  if (level === 'none') {
    console.log(`No release-triggering commits since ${base.tag}; version stays ${previousVersion}.`);
    writeOutput('bumped', 'false');
    writeOutput('version', previousVersion);
    return;
  }

  const nextVersion = bumpSemver(previousVersion, level);
  manifest.version = nextVersion;
  writeFileSync(PLUGIN_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  console.log(`${level}: ${previousVersion} -> ${nextVersion}`);
  writeOutput('bumped', 'true');
  writeOutput('version', nextVersion);
}

if (isDirectRun(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
