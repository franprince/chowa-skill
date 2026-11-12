#!/usr/bin/env node
/**
 * Push protection (pre-tool-use hook)
 *
 * Recognized updates to `main`/`master` and pull-request merges go through
 * the host's authorization flow. The guard does not prescribe a project's
 * integration branch or infer approval from conversation history.
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
 *
 * Each command is judged where it runs, not where the session started:
 * `lib/context.mjs` follows `cd` and `git checkout`/`switch` along the
 * command line, so `git checkout main && git push` is a push to `main`.
 */

import { execFileSync } from 'node:child_process';

import { isDirectRun } from './lib/direct-run.mjs';
import { emit, normalize, resolveDialect } from './lib/harness.mjs';
import { guardsDisabled } from './lib/opt-in.mjs';
import { parseGh, parseGit, resolveDirectory, walkCommands } from './lib/context.mjs';
import { clip, words } from './lib/shell.mjs';

const PROTECTED_BRANCHES = new Set(['main', 'master']);

/** Refspecs that mean "the branch I am on right now". */
const CURRENT_BRANCH_REFS = new Set(['HEAD', '@']);

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

/**
 * Does this `gh api` call write? `gh` sends GET unless told otherwise or
 * given fields, and `GET …/pulls/1/merge` only asks whether a PR is merged.
 */
function ghApiWrites(args) {
  let method;
  let hasFields = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-X' || arg === '--method') method = args[i + 1];
    else if (arg.startsWith('--method=')) method = arg.slice('--method='.length);
    else if (/^-X./.test(arg)) method = arg.slice(2);
    else if (/^(?:-[fF]|--field|--raw-field|--input)(?:$|=)/.test(arg) || /^-[fF]./.test(arg)) hasFields = true;
  }
  return method ? method.toUpperCase() !== 'GET' : hasFields;
}

/**
 * The branch a command acts on: the repository `-C` names, else the branch
 * an earlier command on this line switched to, else the one checked out.
 *
 * Where the command line cannot be followed (`cd "$DIR"`, `git switch -`),
 * the answer is the branch the session started on. That is what this guard
 * always assumed, so losing track never makes it quieter than it was.
 */
function branchFor(step, git, resolveBranch, startCwd) {
  if (git?.directories.length) {
    return resolveBranch(resolveDirectory(step.cwd, ...git.directories) ?? startCwd);
  }
  // `git checkout <word>` may only have restored a file, so an uncertain
  // switch is believed when it adds protection and never when it removes it.
  if (step.branch && (step.branchCertain || PROTECTED_BRANCHES.has(step.branch))) {
    return step.branch;
  }
  // A directory with no repository behind it is one the `cd` never reached
  // (it failed, or the path is wrong), so the command runs where it started.
  return (step.cwd ? resolveBranch(step.cwd) : undefined) ?? resolveBranch(startCwd);
}

/**
 * Does this segment land code on a branch without going through `git push`?
 *
 * The push guard originally read `git push` and nothing else, which left the
 * obvious hole: `gh pr merge` lands a branch on `main` and never invokes
 * `git` at all. An agent following the workflow to the letter — branch, PR,
 * green CI — could still merge its own pull request unattended.
 *
 * Merging is the moment code becomes everyone's problem, so it asks
 * regardless of destination rather than trying to resolve the base branch:
 * `gh pr merge` with no arguments merges the current branch's PR, whose base
 * is only knowable from the network. A hook that made an API call would add
 * that latency to every shell command the agent runs, and would fail open
 * whenever the call failed — the wrong trade for the one action here that
 * cannot be undone by a subsequent commit.
 */
function landsCode(list, git, resolveBranch) {
  const gh = parseGh(list);
  const chain = gh?.subcommands ?? [];

  if (chain[0] === 'pr' && chain[1] === 'merge') {
    return 'merges a pull request';
  }

  // The REST equivalent: `gh api repos/o/r/pulls/1/merge -X PUT`, and the
  // branch-merge endpoint `repos/o/r/merges`.
  if (
    chain[0] === 'api' &&
    chain.some((argument) => /\/(?:merge|merges)(?:[/?]|$)/.test(argument)) &&
    ghApiWrites(gh.args)
  ) {
    return 'merges through the GitHub API';
  }

  // A local merge while sitting on a protected branch moves it immediately;
  // catching it here reports the real action rather than the later push.
  if (git?.subcommand === 'merge') {
    const branch = resolveBranch();
    if (branch && PROTECTED_BRANCHES.has(branch)) {
      return `merges into \`${branch}\`, which is checked out`;
    }
  }

  return undefined;
}

/**
 * Decide whether a command should be blocked.
 *
 * `resolveBranch` is injected so the decision is testable without a real
 * repository; given a directory, it returns the branch checked out there or
 * `undefined`. `cwd` is where the command line starts.
 */
export function decide(command, resolveBranch, cwd = process.cwd()) {
  if (typeof command !== 'string') return { blocked: false };
  if (!command.includes('push') && !command.includes('merge')) {
    return { blocked: false };
  }

  for (const step of walkCommands(command, cwd)) {
    const list = words(step.tokens);
    const git = parseGit(list);
    const currentBranch = () => branchFor(step, git, resolveBranch, cwd);
    const quoted = `\`${clip(step.text)}\``;

    const landing = landsCode(list, git, currentBranch);
    if (landing) {
      return block(`${quoted} ${landing}.`, MERGE_GUIDANCE);
    }

    if (git?.subcommand !== 'push') continue;

    const rest = git.args;

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
      return block(`${quoted} pushes every branch, which includes a protected branch.`);
    }

    // With a refspec, the destination ref decides it. `git push origin main`
    // is blocked; `git push origin release/v1.2.0` is not.
    const refspecs = positionals.slice(1);
    if (refspecs.length > 0) {
      for (const refspec of refspecs) {
        let destination = destinationRef(refspec);
        // `git push origin HEAD` writes to whatever branch is checked out,
        // so the refspec alone doesn't say where it lands.
        if (CURRENT_BRANCH_REFS.has(destination)) destination = currentBranch() ?? destination;

        if (PROTECTED_BRANCHES.has(destination)) {
          return block(
            deleting
              ? `${quoted} would delete the protected branch \`${destination}\`.`
              : `${quoted} pushes directly to \`${destination}\`.`,
          );
        }
      }
      continue;
    }

    // No refspec: the push target is the current branch's upstream.
    const branch = currentBranch();
    if (branch && PROTECTED_BRANCHES.has(branch)) {
      return block(`${quoted} pushes the current branch, which is \`${branch}\`.`);
    }
  }

  return { blocked: false };
}

const GUIDANCE =
  'Direct updates to main/master require authorization. Push a topic branch ' +
  'and open a PR against the repository\'s integration branch.';

const MERGE_GUIDANCE =
  'Landing code is the human\'s decision. Ask for authorization before merging ' +
  'unless the user has already authorized this specific merge.';

function block(reason, guidance = GUIDANCE) {
  return { blocked: true, decision: 'ask', reason: `${reason} ${guidance}` };
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
    return decide(request.command, currentBranchIn, request.cwd);
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
