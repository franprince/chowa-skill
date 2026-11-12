/**
 * Command-line context
 *
 * A hook sees one command line and the directory and branch the session was
 * in *before* it ran. Judging every command against that starting point is
 * wrong in both directions: `cd specs/2026-08-07-x && touch spec.md` writes
 * inside the feature directory and was denied as a root-level spec, while
 * `git checkout main && git merge feat && git push` lands on `main` and was
 * allowed because the session started on a topic branch.
 *
 * `walkCommands` replays the line far enough to fix that: it follows `cd`,
 * `git checkout`/`switch`, and subshell scope, and reports where each command
 * runs. Anything it cannot resolve — `cd "$DIR"`, `cd -`, `git switch -` with
 * no earlier switch — becomes `null`, meaning "cannot tell". What a caller
 * does then is its own policy: the spec guard defers, the push guard falls
 * back to the starting branch.
 */

import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';

import { splitSegments, words } from './shell.mjs';

/** Words that precede a command without being one. */
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{']);

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Commands that run another command. Their own flags vary too much to parse,
 * so the program is searched for anywhere after them — the looser rule that
 * used to apply to every command, kept only where it is needed.
 */
const WRAPPERS = new Set([
  'sudo', 'doas', 'env', 'command', 'builtin', 'exec', 'eval', 'time',
  'timeout', 'nohup', 'nice', 'ionice', 'stdbuf', 'xargs', 'caffeinate',
]);

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

/** `gh`'s flags that consume the following token, ahead of its subcommand. */
const GH_VALUE_FLAGS = new Set(['-R', '--repo']);

/** Flags that name the branch `git checkout`/`switch` creates and moves to. */
const CREATES_BRANCH = {
  checkout: new Set(['-b', '-B', '--orphan']),
  switch: new Set(['-c', '-C', '--create', '--force-create', '--orphan']),
};

const basename = (word) => word.split('/').pop();

/** Path rules follow the directory's own form, not the machine running the hook. */
export function pathApiFor(directory) {
  return /^[A-Za-z]:[\\/]/.test(directory) || directory.startsWith('\\\\') ? win32 : posix;
}

/**
 * Resolve directories in order, as `cd a && cd b` or repeated `-C` would.
 *
 * @param {string|null} from - the starting directory, or `null` if unknown
 * @param {...string} targets
 * @returns {string|null} `null` when the result cannot be determined
 */
export function resolveDirectory(from, ...targets) {
  let directory = from;
  for (let target of targets) {
    if (target === '~' || target.startsWith('~/')) target = homedir() + target.slice(1);
    if (/[$`~*?[]/.test(target)) return null;
    if (directory === null) {
      if (!posix.isAbsolute(target) && !win32.isAbsolute(target)) return null;
      directory = pathApiFor(target).normalize(target);
    } else {
      directory = pathApiFor(directory).resolve(directory, target);
    }
  }
  return directory;
}

/**
 * Commands whose arguments are text, patterns or file names, never a command
 * to run. `echo git push` and `grep -r git push` mention a push without
 * making one. `git` and `gh` are here for each other: `gh pr create --title
 * git push` runs no `git`.
 */
const TAKES_TEXT = new Set([
  'echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'cat', 'bat', 'less',
  'more', 'head', 'tail', 'wc', 'man', 'tldr', 'apropos', 'which', 'whereis',
  'type', 'ls', 'cd', 'pushd', 'test', '[', 'sed', 'awk', 'touch', 'mkdir',
  'rm', 'cp', 'mv', 'git', 'gh',
]);

/**
 * Where `name` sits in a command's words, or -1 if it is not being run.
 *
 * Any program this file does not know may be a wrapper (`flock`, `watch`,
 * a task runner), so `name` is searched for after it. Only a command known
 * to take text is trusted not to run its arguments.
 */
function programIndex(list, name) {
  if (list.length === 0) return -1;
  const program = basename(list[0]).replace(/^\\/, '');
  if (program === name) return 0;
  if (TAKES_TEXT.has(program) && !WRAPPERS.has(program)) return -1;
  return list.findIndex((word, index) => index > 0 && basename(word) === name);
}

/**
 * Read a `git` invocation from a command's words.
 *
 * @param {string[]} list
 * @returns {{ subcommand: string, args: string[], directories: string[] } | null}
 */
export function parseGit(list) {
  const start = programIndex(list, 'git');
  if (start === -1) return null;

  const directories = [];
  for (let i = start + 1; i < list.length; i += 1) {
    const word = list[i];
    if (GIT_VALUE_FLAGS.has(word)) {
      if (word === '-C' && list[i + 1] !== undefined) directories.push(list[i + 1]);
      i += 1;
      continue;
    }
    if (word.startsWith('-')) continue;
    return { subcommand: word, args: list.slice(i + 1), directories };
  }
  return null;
}

/**
 * Read a `gh` invocation: its subcommand chain, and everything after `gh`
 * with flags kept for callers that need them.
 *
 * @param {string[]} list
 * @returns {{ subcommands: string[], args: string[] } | null}
 */
export function parseGh(list) {
  const start = programIndex(list, 'gh');
  if (start === -1) return null;

  const args = [];
  for (let i = start + 1; i < list.length; i += 1) {
    if (args.length === 0 && GH_VALUE_FLAGS.has(list[i])) {
      i += 1;
      continue;
    }
    args.push(list[i]);
  }
  return { subcommands: args.filter((word) => !word.startsWith('-')), args };
}

/** Drop leading assignments and shell keywords, leaving the command itself. */
function withoutPrefix(tokens) {
  let start = 0;
  while (start < tokens.length) {
    const token = tokens[start];
    if (token.operator) break;
    if (!(KEYWORDS.has(token.value) && !token.quoted) && !ASSIGNMENT.test(token.value)) break;
    start += 1;
  }
  return tokens.slice(start);
}

/**
 * The branch a `git checkout`/`switch` moves to.
 *
 * @returns {{ name: string, certain: boolean } | 'previous' | null} `null`
 *   when the command restores paths or does not change branch. `certain` is
 *   false for `git checkout <word>`, which is also how a single file is
 *   restored — the push guard trusts that only towards more protection.
 */
function switchTarget(subcommand, args) {
  const creates = CREATES_BRANCH[subcommand];
  for (let i = 0; i < args.length; i += 1) {
    if (creates.has(args[i])) return args[i + 1] ? { name: args[i + 1], certain: true } : null;
  }

  if (subcommand === 'checkout' && args.includes('--')) return null;

  const positionals = args.filter((word) => word === '-' || !word.startsWith('-'));
  if (positionals.length === 0) return null;
  if (positionals[0] === '-') return 'previous';
  if (args.includes('--detach') || args.includes('-d')) return { name: 'HEAD', certain: true };

  const tracks = args.some((word) => word === '-t' || word.startsWith('--track'));
  if (subcommand === 'checkout') {
    if (positionals.length > 1) return null;
    if (!tracks) return { name: positionals[0], certain: false };
  }
  const [first] = positionals;
  return { name: tracks ? first.slice(first.indexOf('/') + 1) : first, certain: true };
}

/**
 * @typedef {object} Step
 * @property {string} text - the command's source text
 * @property {import('./shell.mjs').Token[]} tokens - without leading assignments and keywords
 * @property {string|null} cwd - where it runs; `null` when that cannot be told
 * @property {string|null|undefined} branch - the branch an earlier command
 *   switched to; `undefined` when none did, so the repository decides;
 *   `null` when a switch happened but its target is unknown
 * @property {boolean} branchCertain - false when `branch` may be a restored path
 */

/**
 * Split a command line into the commands it runs, each with the directory
 * and branch in effect when it starts.
 *
 * @param {string} command
 * @param {string} cwd - where the command line starts
 * @returns {Step[]}
 */
export function walkCommands(command, cwd) {
  const state = { cwd, branch: undefined, certain: true, previous: null, previousCertain: true };
  const saved = [];
  const steps = [];

  const move = (directory) => {
    state.cwd = directory;
  };
  const switchTo = (target, succeeded) => {
    if (target === 'previous') {
      const wasCertain = state.certain;
      [state.branch, state.previous] = [state.previous, state.branch];
      state.certain = state.previousCertain && succeeded;
      state.previousCertain = wasCertain;
      return;
    }
    state.previous = state.branch;
    state.previousCertain = state.certain;
    state.branch = target.name;
    state.certain = target.certain && succeeded;
  };

  // A `cd` or a branch switch takes effect for the next command only as far
  // as the operator between them shows that it ran and succeeded:
  //   `&&`        it succeeded.
  //   `;`, newline it ran, and may have failed. A directory is still
  //               followed (the caller checks that it holds a repository);
  //               a branch is kept as uncertain, so it can add protection
  //               and never remove it.
  //   `||`        the next command runs because it failed, so that command
  //               sees no change; later commands are treated as after `;`.
  //   `|`, `&`    a `cd` ran in a subshell and changes nothing. A branch
  //               switch still happened in the repository, uncertainly.
  /** @type {{ directory?: string|null, target?: object|string } | null} */
  let pending = null;
  /** @type {typeof pending} */
  let deferred = null;

  const apply = (change, succeeded) => {
    if (!change) return;
    if ('directory' in change) move(change.directory);
    else switchTo(change.target, succeeded);
  };

  for (const segment of splitSegments(command)) {
    apply(deferred, false);
    deferred = null;
    if (pending) {
      const isSwitch = 'target' in pending;
      if (segment.before === '&&') apply(pending, true);
      else if (segment.before === '||') deferred = pending;
      else if (segment.before === '|' || segment.before === '&') {
        if (isSwitch) apply(pending, false);
      } else apply(pending, false);
      pending = null;
    }

    const tokens = withoutPrefix(segment.tokens);
    const opened = segment.tokens.reduce((sum, token) => sum + (token.opens ?? 0), 0);
    const closed = segment.tokens.reduce((sum, token) => sum + (token.closes ?? 0), 0);

    // A subshell scopes the directory; a branch switch changes the repository.
    for (let i = 0; i < opened; i += 1) saved.push(state.cwd);

    steps.push({
      text: segment.text,
      tokens,
      cwd: state.cwd,
      branch: state.branch,
      branchCertain: state.certain,
    });

    const list = words(tokens);
    if (list[0] === 'cd' || list[0] === 'pushd') {
      const target = list.slice(1).find((word) => word === '-' || !word.startsWith('-'));
      pending = {
        directory: target === undefined || target === '-' ? null : resolveDirectory(state.cwd, target),
      };
    } else if (list[0] === 'popd') {
      pending = { directory: null };
    } else {
      const git = parseGit(list);
      const switches = git && Object.hasOwn(CREATES_BRANCH, git.subcommand) && git.directories.length === 0;
      const target = switches ? switchTarget(git.subcommand, git.args) : null;
      if (target) pending = { target };
    }

    // A `cd` inside a subshell ends with it.
    if (closed > 0) {
      if (pending && 'directory' in pending) pending = null;
      if (deferred && 'directory' in deferred) deferred = null;
    }
    for (let i = 0; i < closed && saved.length > 0; i += 1) state.cwd = saved.pop();
  }

  return steps;
}
