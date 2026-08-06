#!/usr/bin/env node
/**
 * Push protection (PreToolUse hook)
 *
 * This skill's branching rule — never push directly to `main`/`master`,
 * outside a `release/*` or `hotfix/*` PR — is prose in the skill, which a
 * model may or may not act on. This makes it mechanical.
 *
 * Design constraints, in order of importance:
 *
 * 1. **Fail open.** A guard that blocks input it failed to parse makes the
 *    Bash tool unusable. Every unexpected condition defers to the normal
 *    permission flow; the prose rule remains the backstop for whatever this
 *    misses. Blocking legitimate work is a worse failure than missing an
 *    exotic push form.
 * 2. **Don't break the release flow.** `release/*` and `hotfix/*` branches
 *    are pushed like any other branch before they PR into `main`. Only the
 *    *destination ref* being `main`/`master` is blocked — never the branch
 *    a commit happens to sit on.
 * 3. **No dependencies.** Plain Node, no jq, no packages — this is a pure
 *    skill with no bundled engine, so nothing here can assume one exists.
 */

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROTECTED_BRANCHES = new Set(['main', 'master']);

/** Shell separators that start a new command. */
const SEGMENT_SPLIT = /(?:&&|\|\||;|\||\n)/;

/**
 * Flags that consume the following token as a value. Without this, a value
 * would be mistaken for a positional argument (a remote or a refspec).
 */
const VALUE_FLAGS = new Set(['-o', '--push-option', '--repo', '--exec', '--receive-pack']);

/**
 * Reduce a refspec to the ref it writes on the remote.
 * `HEAD:main` -> `main`, `+refs/heads/main` -> `main`, `feat/x` -> `feat/x`.
 */
function destinationRef(refspec) {
  const withoutForce = refspec.startsWith('+') ? refspec.slice(1) : refspec;
  const colon = withoutForce.lastIndexOf(':');
  const destination = colon === -1 ? withoutForce : withoutForce.slice(colon + 1);
  return destination.replace(/^refs\/heads\//, '');
}

/** Split a command string into segments that could each be their own command. */
function segments(command) {
  return command.split(SEGMENT_SPLIT).map((segment) => segment.trim());
}

/** Is this segment a `git push`? Tolerates leading env assignments and paths. */
function isGitPush(tokens) {
  const gitIndex = tokens.findIndex((token) => token === 'git' || token.endsWith('/git'));
  if (gitIndex === -1) return false;

  // The first token after `git` that isn't a global flag should be `push`.
  for (let i = gitIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('-')) continue;
    if (token === '-C' || token === '--git-dir') {
      i += 1;
      continue;
    }
    return token === 'push';
  }
  return false;
}

/**
 * Decide whether a command should be blocked.
 *
 * `resolveBranch` is injected so the decision is testable without a real
 * repository; it returns the current branch name or `undefined`.
 */
export function decide(command, resolveBranch) {
  if (typeof command !== 'string' || !command.includes('push')) {
    return { blocked: false };
  }

  for (const segment of segments(command)) {
    const tokens = segment.split(/\s+/).filter(Boolean);
    if (!isGitPush(tokens)) continue;

    const pushIndex = tokens.indexOf('push');
    const rest = tokens.slice(pushIndex + 1);

    const positionals = [];
    let deleting = false;
    let pushesEverything = false;

    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (VALUE_FLAGS.has(token)) {
        i += 1;
        continue;
      }
      if (token === '-d' || token === '--delete') {
        deleting = true;
        continue;
      }
      if (token === '--all' || token === '--mirror') {
        pushesEverything = true;
        continue;
      }
      if (token.startsWith('-')) continue;
      positionals.push(token);
    }

    // `--all`/`--mirror` push every branch, main included.
    if (pushesEverything) {
      return {
        blocked: true,
        reason: `\`${segment}\` pushes every branch, which includes a protected branch.`,
      };
    }

    // With a refspec, the destination ref decides it. `git push origin main`
    // is blocked; `git push origin release/v1.2.0` is not.
    const refspecs = positionals.slice(1);
    if (refspecs.length > 0) {
      for (const refspec of refspecs) {
        const destination = destinationRef(refspec);
        if (PROTECTED_BRANCHES.has(destination)) {
          return {
            blocked: true,
            reason: deleting
              ? `\`${segment}\` would delete the protected branch \`${destination}\`.`
              : `\`${segment}\` pushes directly to \`${destination}\`.`,
          };
        }
      }
      continue;
    }

    // No refspec: the push target is the current branch's upstream.
    const branch = resolveBranch();
    if (branch && PROTECTED_BRANCHES.has(branch)) {
      return {
        blocked: true,
        reason: `\`${segment}\` pushes the current branch, which is \`${branch}\`.`,
      };
    }
  }

  return { blocked: false };
}

const GUIDANCE =
  'Never push directly to main/master. Branch (feat/*, fix/*, docs/*, ' +
  'chore/*) and PR into develop; only release/* and hotfix/* PR into main.';

function currentBranchIn(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

function defer() {
  process.exit(0);
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return defer(); // Unparseable payload: not our call to block on.
  }

  if (payload?.tool_name !== 'Bash') return defer();

  let verdict;
  try {
    verdict = decide(payload?.tool_input?.command, () => currentBranchIn(payload?.cwd));
  } catch {
    return defer(); // Fail open, always.
  }

  if (!verdict.blocked) return defer();

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${verdict.reason} ${GUIDANCE}`,
      },
    }),
  );
  process.exit(0);
}

// Only run when executed directly, so tests can import `decide`.
//
// Compare decoded paths rather than building a `file://` string by hand: any
// non-ASCII character in the install path is percent-encoded in
// `import.meta.url` but not in `argv[1]`, so the naive string comparison
// silently never matches and the hook does nothing. `realpathSync`
// additionally covers being invoked through a symlink, where the two would
// otherwise disagree. Failure here is silent by nature, so it is worth the
// extra call.
function isDirectRun() {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(import.meta.url);
  if (self === process.argv[1]) return true;
  try {
    return realpathSync(self) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main();
}
