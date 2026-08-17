#!/usr/bin/env node
/**
 * Storybook before/after visual proof (on-request)
 *
 * Given a webapp project with Storybook and Playwright already
 * configured, captures "before" (base ref) and "after" (current working
 * tree) screenshots of the Storybook stories belonging to components
 * touched by the diff, and renders a ready-to-paste Markdown comparison
 * table for a PR's `### Visual Proof` section.
 *
 * Run on-request only, from inside the target webapp project's own
 * working directory:
 *
 *   node scripts/storybook-proof.mjs --base <ref> [--stories <ids>] [--all] [--port <number>]
 *
 * Shells out to the target project's own `storybook`/`playwright`
 * (via `npx`) rather than importing either as a library, so this
 * script itself carries no new dependency.
 */

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';

import { isDirectRun } from './lib/direct-run.mjs';

const STORY_EXTENSIONS = ['.stories.tsx', '.stories.ts', '.stories.jsx', '.stories.js', '.stories.mdx'];
const COMPONENT_PATTERN = /\.(tsx|ts|jsx|js|vue|svelte)$/;
const STORY_PATTERN = /\.stories\.(tsx|ts|jsx|js|mdx)$/;

/**
 * Map changed files to their corresponding Storybook story files.
 *
 * A changed file that is itself a `*.stories.*` file is included
 * directly. A changed component file resolves to the first sibling
 * `<basename>.stories.<ext>` reported present by `exists`. Files with
 * no story counterpart are skipped. Results are deduplicated.
 */
export function resolveStoryFilesFromDiff(changedFiles, exists) {
  const found = [];
  const seen = new Set();

  for (const file of changedFiles) {
    let storyFile = null;

    if (STORY_PATTERN.test(file)) {
      storyFile = file;
    } else if (COMPONENT_PATTERN.test(file)) {
      const base = file.replace(COMPONENT_PATTERN, '');
      for (const ext of STORY_EXTENSIONS) {
        const candidate = base + ext;
        if (exists(candidate)) {
          storyFile = candidate;
          break;
        }
      }
    }

    if (storyFile && !seen.has(storyFile)) {
      seen.add(storyFile);
      found.push(storyFile);
    }
  }

  return found;
}

/** Insert `-` at camelCase/PascalCase word boundaries, lowercase the result. */
function camelToKebab(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** Storybook-style slug: lowercase, non-alphanumeric runs collapsed to `-`, trimmed. */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract Storybook story IDs from a CSF file's source text.
 *
 * A regex-level approximation of Storybook's own `toId()`: reads the
 * `title` static export and every `export const <Name>` (excluding
 * `default`), and computes `<title-slug>--<export-name-slug>` for each.
 * Non-standard CSF (dynamic titles, `storyName` overrides) isn't
 * resolved — falls back to the `--stories`/`--all` CLI overrides.
 * A file with no `title` yields no IDs.
 */
export function extractStoryIdsFromSource(source) {
  const titleMatch = source.match(/title\s*:\s*['"]([^'"]+)['"]/);
  if (!titleMatch) return [];

  const titleSlug = slugify(titleMatch[1]);
  const ids = [];
  const exportPattern = /export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let match;
  while ((match = exportPattern.exec(source)) !== null) {
    const exportName = match[1];
    if (exportName === 'default') continue;
    ids.push(`${titleSlug}--${slugify(camelToKebab(exportName))}`);
  }

  return ids;
}

/**
 * Classify story IDs present at the base ref vs. the head state.
 * Returns a sorted array of `{ id, status }`, status one of
 * `'changed' | 'new' | 'removed'`.
 */
export function classifyStories(baseIds, headIds) {
  const baseSet = new Set(baseIds);
  const headSet = new Set(headIds);
  const all = new Set([...baseSet, ...headSet]);

  return [...all].sort().map((id) => {
    const inBase = baseSet.has(id);
    const inHead = headSet.has(id);
    const status = inBase && inHead ? 'changed' : inHead ? 'new' : 'removed';
    return { id, status };
  });
}

/**
 * Render the before/after Markdown comparison table.
 * `entries: { id, status: 'changed'|'new'|'removed'|'failed', beforePath?, afterPath? }[]`
 */
export function buildComparisonTable(entries) {
  const header = '| Component / Story | Before | After |\n|---|---|---|';
  const rows = entries.map(({ id, status, beforePath, afterPath }) => {
    if (status === 'failed') {
      return `| \`${id}\` | *screenshot failed* | *screenshot failed* |`;
    }
    if (status === 'new') {
      return `| \`${id}\` | *N/A (New Component)* | ![After](${afterPath}) |`;
    }
    if (status === 'removed') {
      return `| \`${id}\` | ![Before](${beforePath}) | *N/A (Removed)* |`;
    }
    return `| \`${id}\` | ![Before](${beforePath}) | ![After](${afterPath}) |`;
  });

  return [header, ...rows].join('\n');
}

/** Find a free TCP port by binding to port 0 and reading the OS-assigned port. */
function findFreePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolvePromise(port));
    });
  });
}

/** Poll a URL until it responds successfully or the timeout elapses. */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Storybook did not become ready at ${url} within ${timeoutMs}ms`);
}

function spawnStorybook(cwd, port) {
  const child = spawn('npx', ['storybook', 'dev', '-p', String(port), '--ci'], {
    cwd,
    stdio: 'ignore',
  });
  return child;
}

function killProcess(child) {
  if (child && !child.killed) child.kill('SIGTERM');
}

async function captureStories(cwd, port, ids, outDir, suffix, failed) {
  const paths = {};
  for (const id of ids) {
    const outPath = join(outDir, `${id}-${suffix}.png`);
    const url = `http://localhost:${port}/iframe.html?id=${id}&viewMode=story`;
    try {
      execFileSync('npx', ['playwright', 'screenshot', url, outPath], { cwd, stdio: 'ignore' });
      paths[id] = outPath;
    } catch {
      failed.add(id);
    }
  }
  return paths;
}

function resolveSpecDir(repoRoot) {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot })
    .toString()
    .trim();
  const slug = branch.split('/').pop();

  const specsDir = join(repoRoot, 'specs');
  if (!existsSync(specsDir)) return null;

  const matches = readdirSync(specsDir).filter((name) => name.endsWith(`-${slug}`));
  return matches.length === 1 ? join(specsDir, matches[0]) : null;
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { port: null, stories: null, all: false, base: null, outDir: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') args.base = argv[++i];
    else if (arg === '--stories') args.stories = argv[++i].split(',');
    else if (arg === '--all') args.all = true;
    else if (arg === '--port') args.port = Number(argv[++i]);
    else if (arg === '--out-dir') args.outDir = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  if (!args.base) fail('Missing required --base <ref>.');

  if (!existsSync(join(cwd, '.storybook'))) {
    fail('No .storybook/ config found. Set up Storybook in this project before running this tool.');
  }

  try {
    execFileSync('npx', ['playwright', '--version'], { cwd, stdio: 'ignore' });
  } catch {
    fail('Playwright is not resolvable via `npx` in this project. Add it as a devDependency first.');
  }

  try {
    execFileSync('git', ['rev-parse', '--verify', args.base], { cwd, stdio: 'ignore' });
  } catch {
    fail(`Base ref \`${args.base}\` is not reachable locally. Fetch it first.`);
  }

  const outDir = args.outDir ?? (() => {
    const specDir = resolveSpecDir(cwd);
    if (!specDir) {
      fail('Could not uniquely resolve the active specs/<date>-<slug>/ directory from the current branch. Pass --out-dir explicitly.');
    }
    return join(specDir, 'proof');
  })();
  mkdirSync(outDir, { recursive: true });

  let targetStoryFiles;
  if (args.stories || args.all) {
    targetStoryFiles = null; // handled below via direct ID lists
  } else {
    const changedFiles = execFileSync('git', ['diff', '--name-only', `${args.base}...HEAD`], { cwd })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
    targetStoryFiles = resolveStoryFilesFromDiff(changedFiles, (p) => existsSync(join(cwd, p)));
  }

  const cleanup = [];
  const runCleanup = () => {
    for (const fn of cleanup.splice(0)) {
      try {
        fn();
      } catch {
        // best-effort teardown
      }
    }
  };
  process.on('SIGINT', () => {
    runCleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    runCleanup();
    process.exit(143);
  });

  const failed = new Set();

  // --- Before: base ref, via a temporary worktree ---
  const worktreeDir = join(cwd, '.git', 'chowa-worktrees', 'proof-base');
  execFileSync('git', ['worktree', 'add', worktreeDir, args.base], { cwd, stdio: 'ignore' });
  cleanup.push(() => execFileSync('git', ['worktree', 'remove', '--force', worktreeDir], { cwd, stdio: 'ignore' }));

  const basePort = args.port ?? (await findFreePort());
  let baseIds = [];
  if (args.all || args.stories) {
    baseIds = args.stories ?? [];
  } else {
    for (const file of targetStoryFiles) {
      try {
        const source = execFileSync('git', ['show', `${args.base}:${file}`], { cwd }).toString();
        baseIds.push(...extractStoryIdsFromSource(source));
      } catch {
        // file didn't exist at base — all its stories are 'new'
      }
    }
  }

  let beforePaths = {};
  if (baseIds.length > 0) {
    const baseChild = spawnStorybook(worktreeDir, basePort);
    cleanup.push(() => killProcess(baseChild));
    await waitForServer(`http://localhost:${basePort}/iframe.html`, 30000);
    beforePaths = await captureStories(worktreeDir, basePort, baseIds, outDir, 'before', failed);
    killProcess(baseChild);
  }

  execFileSync('git', ['worktree', 'remove', '--force', worktreeDir], { cwd, stdio: 'ignore' });

  // --- After: current working tree ---
  let headIds = [];
  if (args.all || args.stories) {
    headIds = args.stories ?? [];
  } else {
    for (const file of targetStoryFiles) {
      const fullPath = join(cwd, file);
      if (existsSync(fullPath)) {
        headIds.push(...extractStoryIdsFromSource(readFileSync(fullPath, 'utf-8')));
      }
    }
  }

  let afterPaths = {};
  if (headIds.length > 0) {
    const headPort = args.port ?? (await findFreePort());
    const headChild = spawn('npx', ['storybook', 'dev', '-p', String(headPort), '--ci'], { cwd, stdio: 'ignore' });
    cleanup.push(() => killProcess(headChild));
    await waitForServer(`http://localhost:${headPort}/iframe.html`, 30000);
    afterPaths = await captureStories(cwd, headPort, headIds, outDir, 'after', failed);
    killProcess(headChild);
  }

  runCleanup();

  const entries = classifyStories(baseIds, headIds).map(({ id, status }) => ({
    id,
    status: failed.has(id) ? 'failed' : status,
    beforePath: beforePaths[id] ? relative(cwd, beforePaths[id]) : undefined,
    afterPath: afterPaths[id] ? relative(cwd, afterPaths[id]) : undefined,
  }));

  const table = buildComparisonTable(entries);
  console.log(table);
  writeFileSync(join(dirname(outDir), 'visual-proof-snippet.md'), `${table}\n`, 'utf-8');
}

if (isDirectRun(import.meta.url)) {
  main();
}
