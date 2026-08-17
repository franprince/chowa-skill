#!/usr/bin/env node
/**
 * Hook installation
 *
 * Claude Code discovers `hooks/hooks.json` on its own when this repository
 * is installed as a plugin. Gemini CLI and Codex have no equivalent — their
 * hooks live in the user's own configuration, which means the guards are
 * only "supported" there if something merges them in. Hand-editing JSON
 * that already has other hooks in it is exactly the kind of step that gets
 * skipped or done wrong, so this does it.
 *
 * The merge is idempotent: any previously installed Chōwa entry is replaced
 * rather than appended to, keyed on the script path, so re-running after an
 * upgrade updates in place instead of stacking duplicates.
 *
 * Usage:
 *   node scripts/install-hooks.mjs --harness gemini
 *   node scripts/install-hooks.mjs --harness codex --scope project
 *   node scripts/install-hooks.mjs --all --dry-run
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isDirectRun } from './lib/direct-run.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Substituted for the absolute path to this checkout at install time. */
const ROOT_PLACEHOLDER = '__CHOWA_SKILL_ROOT__';

/** Marks an entry as ours, so re-installing replaces instead of duplicating. */
const OWNERSHIP_MARKER = 'scripts/guard';

/**
 * Where each harness keeps its hooks, and in what shape.
 *
 * Three of the four nest definitions under a `hooks` object keyed by event.
 * Antigravity instead names each hook at the top level
 * (`{"chowa-guards": {"PreToolUse": [...]}}`), so `hookName` selects that
 * shape and doubles as the key we own in the user's file.
 */
export const HARNESSES = {
  claude: {
    event: 'PreToolUse',
    snippet: join(repoRoot, 'hooks/hooks.json'),
    user: () => join(homedir(), '.claude', 'settings.json'),
    project: (cwd) => join(cwd, '.claude', 'settings.json'),
    note:
      'Only needed when using this repository outside the plugin system — ' +
      '`/plugin install chowa-skill` wires the same hooks up automatically.',
  },
  gemini: {
    event: 'BeforeTool',
    snippet: join(repoRoot, 'hooks/gemini-settings.json'),
    user: () => join(homedir(), '.gemini', 'settings.json'),
    project: (cwd) => join(cwd, '.gemini', 'settings.json'),
  },
  codex: {
    event: 'PreToolUse',
    snippet: join(repoRoot, 'hooks/codex-hooks.json'),
    user: () => join(homedir(), '.codex', 'hooks.json'),
    project: (cwd) => join(cwd, '.codex', 'hooks.json'),
  },
  antigravity: {
    event: 'PreToolUse',
    hookName: 'chowa-guards',
    snippet: join(repoRoot, 'hooks/antigravity-hooks.json'),
    user: () => join(homedir(), '.gemini', 'config', 'hooks.json'),
    project: (cwd) => join(cwd, '.agents', 'hooks.json'),
  },
};

/** Does this hook definition belong to us? */
function isOurs(definition) {
  return (definition?.hooks ?? []).some((hook) =>
    typeof hook?.command === 'string' ? hook.command.includes(OWNERSHIP_MARKER) : false,
  );
}

/**
 * Merge our hook definitions into an existing configuration object.
 *
 * @param {object} existing - the parsed current config (or `{}`)
 * @param {object} snippet - the parsed config we ship
 * @param {{ event: string, hookName?: string }} harness
 * @returns {object} a new config object; `existing` is not mutated
 */
export function mergeHooks(existing, snippet, harness) {
  const merged = structuredClone(existing ?? {});

  // Named shape: the whole entry lives under one key we own outright, so
  // replacing it is already idempotent and leaves other hooks untouched.
  if (harness.hookName) {
    merged[harness.hookName] = snippet[harness.hookName];
    return merged;
  }

  merged.hooks ??= {};
  const current = Array.isArray(merged.hooks[harness.event]) ? merged.hooks[harness.event] : [];
  const theirs = current.filter((definition) => !isOurs(definition));
  const ours = snippet?.hooks?.[harness.event] ?? [];

  merged.hooks[harness.event] = [...theirs, ...ours];
  return merged;
}

/**
 * Read the shipped snippet with the repository path substituted in.
 *
 * Substitution happens after parsing rather than on the raw text, so
 * nothing here has to reason about JSON escaping.
 *
 * `${CLAUDE_PLUGIN_ROOT}` is expanded too: it is only defined for a
 * plugin-managed install, and writing into `settings.json` by hand is
 * precisely the case where it is not — there, this checkout is the root.
 */
export function loadSnippet(snippetPath, root = repoRoot) {
  const substitute = (value) => {
    if (typeof value === 'string') {
      return value
        .replaceAll(ROOT_PLACEHOLDER, root)
        .replaceAll('"${CLAUDE_PLUGIN_ROOT}"', JSON.stringify(root));
    }
    if (Array.isArray(value)) return value.map(substitute);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item)]));
    }
    return value;
  };

  // Walked generically rather than reaching into `hooks[event][].hooks[]`,
  // because the four harnesses do not agree on that nesting.
  return substitute(JSON.parse(readFileSync(snippetPath, 'utf-8')));
}

function readConfig(configPath) {
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(
      `${configPath} exists but is not valid JSON. Fix or move it, then re-run.`,
      { cause: error },
    );
  }
}

/**
 * Install for one harness.
 *
 * @returns {{ configPath: string, content: string, changed: boolean }}
 */
export function install(harnessName, { scope = 'user', cwd = process.cwd(), dryRun = false } = {}) {
  const harness = HARNESSES[harnessName];
  if (!harness) {
    throw new Error(
      `Unknown harness "${harnessName}". Expected one of: ${Object.keys(HARNESSES).join(', ')}.`,
    );
  }

  const configPath = scope === 'project' ? harness.project(cwd) : harness.user();
  const before = readConfig(configPath);
  const merged = mergeHooks(before, loadSnippet(harness.snippet), harness);
  const content = `${JSON.stringify(merged, null, 2)}\n`;
  const changed = JSON.stringify(before) !== JSON.stringify(merged);

  if (!dryRun && changed) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, content, 'utf-8');
  }

  return { configPath, content, changed };
}

function parseArguments(argv) {
  const read = (flag) => {
    const index = argv.indexOf(flag);
    return index !== -1 ? argv[index + 1] : undefined;
  };
  return {
    harnesses: argv.includes('--all')
      ? Object.keys(HARNESSES)
      : [read('--harness')].filter(Boolean),
    scope: read('--scope') ?? 'user',
    dryRun: argv.includes('--dry-run'),
  };
}

function main() {
  const { harnesses, scope, dryRun } = parseArguments(process.argv.slice(2));

  if (harnesses.length === 0) {
    console.error(
      'Usage: node scripts/install-hooks.mjs --harness <claude|gemini|codex> [--scope user|project] [--dry-run]\n' +
        '       node scripts/install-hooks.mjs --all',
    );
    process.exit(1);
  }

  for (const harnessName of harnesses) {
    const { configPath, content, changed } = install(harnessName, { scope, dryRun });
    if (dryRun) {
      console.log(`— ${harnessName} → ${configPath}${changed ? '' : ' (already current)'}\n${content}`);
    } else {
      console.log(`✅ ${harnessName} → ${configPath}${changed ? '' : ' (already current)'}`);
    }
    if (HARNESSES[harnessName].note) console.log(`   ${HARNESSES[harnessName].note}`);
  }
}

if (isDirectRun(import.meta.url)) {
  main();
}
