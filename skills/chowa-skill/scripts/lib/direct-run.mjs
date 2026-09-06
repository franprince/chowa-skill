/**
 * Direct-run detection
 *
 * Every script here is both a module (tests import its pure functions) and
 * an entry point (a harness executes it). The idiomatic guard for that,
 * `import.meta.url === \`file://${process.argv[1]}\``, is wrong in two ways
 * that both fail *silently* — the script is imported, nothing runs, exit 0,
 * indistinguishable from "the guard allowed it":
 *
 * 1. **Non-ASCII paths.** `import.meta.url` percent-encodes anything outside
 *    the URL-safe set; `process.argv[1]` does not. A user whose home
 *    directory contains an accent — or an install path containing `chōwa` —
 *    never matches, so the hook does nothing forever.
 * 2. **Symlinks.** Node resolves the module URL to the real path but leaves
 *    `argv[1]` as invoked, so a symlinked script (how local plugin
 *    development works) never matches either.
 *
 * `fileURLToPath` fixes the first by decoding rather than encoding;
 * `realpathSync` fixes the second by comparing canonical paths. Failure is
 * silent by nature here, so the extra syscall is worth it.
 */

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Is the module identified by `importMetaUrl` the process entry point?
 *
 * @param {string} importMetaUrl - the caller's own `import.meta.url`
 * @returns {boolean}
 */
export function isDirectRun(importMetaUrl) {
  if (!process.argv[1]) return false;

  let self;
  try {
    self = fileURLToPath(importMetaUrl);
  } catch {
    return false;
  }

  if (self === process.argv[1]) return true;

  try {
    return realpathSync(self) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
