#!/usr/bin/env node
/**
 * Push protection (pre-tool-use hook)
 *
 * This skill's branching rule — never push directly to `main`/`master`,
 * outside a `release/*` or `hotfix/*` PR — is prose in the skill, which a
 * model may or may not act on. This makes it mechanical.
 *
 * Design constraints, in order of importance:
 *
 * 1. **Fail open.** A guard that blocks input it failed to parse makes the
 *    shell tool unusable. Every unexpected condition defers to the normal
 *    permission flow; the prose rule remains the backstop for whatever this
 *    misses. Blocking legitimate work is a worse failure than missing an
 *    exotic push form.
 * 2. **Don't break the release flow.** `release/*` and `hotfix/*` branches
 *    are pushed like any other branch before they PR into `main`. Only the
 *    *destination ref* being `main`/`master` is blocked — never the branch
 *    a commit happens to sit on.
 * 3. **The human decides.** Whether to push to `main` is not a convention
 *    the agent should be able to route around, nor one it should be denied
 *    outright — a repository's own first push is a legitimate case. So the
 *    verdict is `ask` wherever the harness can route a decision to the
 *    user, and `deny` only where it cannot. `CHOWA_GUARDS=off` opts out
 *    entirely.
 * 4. **No dependencies.** Plain Node, no jq, no packages — this is a pure
 *    skill with no bundled engine, so nothing here can assume one exists.
 *
 * This guard is unconditional: unlike the spec guard, it encodes no
 * Chōwa-specific convention, only the near-universal one about `main`.
 */

import { execFileSync } from 'node:child_process';

import { isDirectRun } from './lib/direct-run.mjs';
import { emit, normalize, resolveDialect } from './lib/harness.mjs';
import { guardsDisabled } from './lib/opt-in.mjs';
import { splitSegments, words } from './lib/shell.mjs';

const PROTECTED_BRANCHES = new Set(['main', 'master']);

/** Refspecs that mean "the branch I am on right now". */
const CURRENT_BRANCH_REFS = new Set(['HEAD', '@']);

/**
 * `git`'s own flags that consume the following token as a value. These have
 * to be recognized *before* the generic "skip anything starting with `-`"
 * rule, or the value is mistaken for the subcommand: `git -C /repo push`
 * reads as subcommand `/repo`, and the push sails through unguarded.
 */
const GIT_VALUE_FLAGS = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
  '--config-env',
]);

/**
 * `git push`'s flags that consume the following token as a value. Without
 * this, a value would be mistaken for a positional (a remote or a refspec).
 */
const PUSH_VALUE_FLAGS = new Set(['-o', '--push-option', '--repo', '--exec', '--receive-pack']);

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

/** Is this segment a `git push`? Tolerates leading env assignments and paths. */
function isGitPush(tokens) {
  const gitIndex = tokens.findIndex((token) => token === 'git' || token.endsWith('/git'));
  if (gitIndex === -1) return false;

  // The first token after `git` that is neither a global flag nor a global
  // flag's value should be `push`.
  for (let i = gitIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (GIT_VALUE_FLAGS.has(token)) {
      i += 1;
      continue;
    }
    if (token.startsWith('-')) continue;
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

  for (const segment of splitSegments(command)) {
    const tokens = words(segment.tokens);
    if (!isGitPush(tokens)) continue;

    const pushIndex = tokens.indexOf('push');
    const rest = tokens.slice(pushIndex + 1);

    const positionals = [];
    let deleting = false;
    let pushesEverything = false;

    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (PUSH_VALUE_FLAGS.has(token)) {
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
      return block(`\`${segment.text}\` pushes every branch, which includes a protected branch.`);
    }

    // With a refspec, the destination ref decides it. `git push origin main`
    // is blocked; `git push origin release/v1.2.0` is not.
    const refspecs = positionals.slice(1);
    if (refspecs.length > 0) {
      for (const refspec of refspecs) {
        let destination = destinationRef(refspec);
        // `git push origin HEAD` writes to whatever branch is checked out,
        // so the refspec alone doesn't say where it lands.
        if (CURRENT_BRANCH_REFS.has(destination)) destination = resolveBranch() ?? destination;

        if (PROTECTED_BRANCHES.has(destination)) {
          return block(
            deleting
              ? `\`${segment.text}\` would delete the protected branch \`${destination}\`.`
              : `\`${segment.text}\` pushes directly to \`${destination}\`.`,
          );
        }
      }
      continue;
    }

    // No refspec: the push target is the current branch's upstream.
    const branch = resolveBranch();
    if (branch && PROTECTED_BRANCHES.has(branch)) {
      return block(`\`${segment.text}\` pushes the current branch, which is \`${branch}\`.`);
    }
  }

  return { blocked: false };
}

const GUIDANCE =
  'Never push directly to main/master. Branch (feat/*, fix/*, docs/*, ' +
  'chore/*) and PR into develop; only release/* and hotfix/* PR into main.';

function block(reason) {
  return { blocked: true, decision: 'ask', reason: `${reason} ${GUIDANCE}` };
}

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

/**
 * Decide against a normalized request, for the dispatcher.
 *
 * @param {import('./lib/harness.mjs').Request} request
 */
export function inspect(request) {
  if (!request.command) return { blocked: false };
  try {
    return decide(request.command, () => currentBranchIn(request.cwd));
  } catch {
    return { blocked: false }; // Fail open, always.
  }
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {}; // Unparseable payload: not our call to block on.
  }

  const dialect = resolveDialect({ argv: process.argv.slice(2), env: process.env, payload });
  if (guardsDisabled()) return emit({ blocked: false }, dialect);

  emit(inspect(normalize(payload, dialect)), dialect);
}

if (isDirectRun(import.meta.url)) {
  main();
}
