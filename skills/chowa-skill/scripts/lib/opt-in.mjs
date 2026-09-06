/**
 * Project opt-in
 *
 * SKILL.md Activation recognizes persistent opt-in through `specs/INDEX.md`,
 * `chowa.config.js`, `chowa.config.ts`, `chowa.config.mjs`, or the personal
 * `alwaysOn` preference. Stateless hooks can read these same signals.
 *
 * A user can also activate the workflow in conversation. Hooks cannot read
 * that authorization; they recognize it once a persistent marker exists.
 *
 * Opt-in applies to the spec guard only. The push guard applies in every
 * project and requests authorization where the harness supports it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Files whose presence means the project follows this workflow. */
const OPT_IN_MARKERS = [
  join('specs', 'INDEX.md'),
  'chowa.config.js',
  'chowa.config.ts',
  'chowa.config.mjs',
];

export const PREFERENCES_PATH = join(homedir(), '.chowa-skill', 'preferences.json');

/**
 * Escape hatch for the cases neither `deny` nor `ask` covers — bootstrapping
 * a repository, or scripted runs where no human is present to answer.
 *
 * @param {Record<string, string|undefined>} env
 * @returns {boolean}
 */
export function guardsDisabled(env = process.env) {
  const setting = env.CHOWA_GUARDS?.toLowerCase();
  return setting === 'off' || setting === '0' || setting === 'false';
}

/** Is always-on set in the personal preferences file? */
export function alwaysOn(preferencesPath = PREFERENCES_PATH) {
  try {
    return JSON.parse(readFileSync(preferencesPath, 'utf-8'))?.alwaysOn === true;
  } catch {
    return false; // Missing or unreadable preferences mean off, per Activation.
  }
}

/**
 * Does this project follow the spec → plan → execute convention?
 *
 * Walks up from `cwd` so the answer doesn't depend on which subdirectory
 * the session happens to be in, and stops at the repository root rather
 * than escaping into a parent project that happens to have opted in.
 *
 * @param {string} cwd
 * @param {{ preferencesPath?: string }} [options]
 * @returns {boolean}
 */
export function isOptedIn(cwd, { preferencesPath = PREFERENCES_PATH } = {}) {
  if (alwaysOn(preferencesPath)) return true;
  if (typeof cwd !== 'string' || !cwd) return false;

  let directory = cwd;
  for (;;) {
    for (const marker of OPT_IN_MARKERS) {
      if (existsSync(join(directory, marker))) return true;
    }
    if (existsSync(join(directory, '.git'))) return false; // repository root

    const parent = dirname(directory);
    if (parent === directory) return false; // filesystem root
    directory = parent;
  }
}

/** Locate the nearest workflow root or repository boundary for path checks. */
export function findProjectRoot(cwd) {
  let directory = cwd;
  for (;;) {
    if (OPT_IN_MARKERS.some((marker) => existsSync(join(directory, marker))) ||
        existsSync(join(directory, '.git'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return cwd;
    directory = parent;
  }
}
