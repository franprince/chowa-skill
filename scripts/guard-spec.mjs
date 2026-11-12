#!/usr/bin/env node
/**
 * Spec protection (pre-tool-use hook)
 *
 * Prevents agents from creating loose root-level spec files (`spec.md`,
 * `implementation_plan.md`, or `tasks.md`). Enforces that specs must live
 * inside dedicated feature directories under `specs/<YYYY-MM-DD>-<slug>/`
 * and be recorded in `specs/INDEX.md`.
 *
 * Iterating on specs is supported by editing files inside `specs/<YYYY-MM-DD>-<slug>/`.
 *
 * Three things scope this deliberately:
 *
 * 1. **It only applies where the convention does.** A root-level `tasks.md`
 *    is an ordinary file in most repositories, and this guard has no
 *    business rejecting it in a project that never adopted the spec →
 *    plan → execute layout. `inspect` checks the persistent signals listed
 *    in SKILL.md Activation; conversation-only activation is unavailable to
 *    stateless hooks. `decide` stays pure policy so it can be tested without
 *    a project around it.
 * 2. **It denies rather than asks.** The reason text tells the agent
 *    exactly where the file belongs instead, so it can correct itself on
 *    the next call — routing a path convention to the user would be noise.
 *    The push guard makes the opposite call, for the opposite reason.
 * 3. **It leaves files the repository already tracks alone.** A committed
 *    root `SPEC.md` is the project's own document, not a stray draft, and
 *    the relocation advice would be wrong for it. Only `inspect` asks git;
 *    `decide` takes the answer as a predicate.
 *
 * Shell writes are resolved against the directory each command runs in:
 * `cd specs/2026-08-07-x && touch spec.md` writes inside the feature
 * directory, which is exactly where the file belongs.
 */

import { execFileSync } from 'node:child_process';

import { pathApiFor, walkCommands } from './lib/context.mjs';
import { isDirectRun } from './lib/direct-run.mjs';
import { emit, normalize, resolveDialect } from './lib/harness.mjs';
import { findProjectRoot, guardsDisabled, isOptedIn } from './lib/opt-in.mjs';
import { applyPatchTargets, clip, redirectTargets, words } from './lib/shell.mjs';

/** The spec documents that belong in a feature directory, never at the root. */
const SPEC_FILENAMES = new Set(['spec.md', 'implementation_plan.md', 'tasks.md']);

/** Commands where every operand is a file being written. */
const WRITES_ALL_OPERANDS = new Set(['touch', 'tee', 'truncate']);

/** Commands where the final operand is the destination. */
const WRITES_LAST_OPERAND = new Set(['cp', 'mv', 'install', 'ln', 'rsync']);

/**
 * Check if a file path refers to a loose root-level spec or implementation plan.
 * Returns true if the target is root-level `spec.md`, `implementation_plan.md`,
 * or `tasks.md`.
 */
export function isRootSpecPath(targetPath, cwd = process.cwd(), projectRoot = cwd) {
  if (!targetPath || typeof targetPath !== 'string') return false;

  const pathApi = pathApiFor(cwd);
  const absoluteTarget = pathApi.resolve(cwd, targetPath);
  const relativeTarget = pathApi.relative(projectRoot, absoluteTarget);

  // Normalizes paths like `spec.md` or `./spec.md` to `spec.md`
  return SPEC_FILENAMES.has(relativeTarget.toLowerCase());
}

/**
 * The files a single command writes to: redirect targets plus the operands
 * of the commands that create or overwrite files.
 */
function writeTargets(tokens) {
  const targets = redirectTargets(tokens);
  const operands = words(tokens);
  if (operands.length < 2) return targets;

  let [command, ...rest] = operands;
  // `git mv old new` behaves like `mv` for this purpose.
  if (command === 'git' && rest[0] === 'mv') {
    command = 'mv';
    rest = rest.slice(1);
  }

  // `dd of=spec.md` names its destination in a parameter.
  if (command === 'dd') {
    for (const operand of rest) {
      if (operand.startsWith('of=')) targets.push(operand.slice(3));
    }
    return targets;
  }

  const flagless = rest.filter((operand) => !operand.startsWith('-'));
  if (flagless.length === 0) return targets;

  // `sed` only writes when editing in place.
  if (command === 'sed') {
    if (rest.some((operand) => operand === '-i' || operand.startsWith('-i'))) {
      // The first flagless operand is the script, the rest are files.
      targets.push(...flagless.slice(1));
    }
    return targets;
  }

  if (WRITES_ALL_OPERANDS.has(command)) targets.push(...flagless);
  else if (WRITES_LAST_OPERAND.has(command)) targets.push(flagless[flagless.length - 1]);

  return targets;
}

/** Nothing is tracked: the answer when no repository has been consulted. */
const untracked = () => false;

/**
 * Is this write one the guard rejects: a root-level spec file that the
 * repository does not already track? `isTracked` is only consulted once the
 * path is known to be a root spec, so ordinary writes never reach git.
 */
function isLooseRootSpec(target, cwd, projectRoot, isTracked) {
  if (!isRootSpecPath(target, cwd, projectRoot)) return false;
  return !isTracked(pathApiFor(cwd).resolve(cwd, target));
}

/**
 * The first command on a line that writes a loose root-level spec file, if
 * any.
 *
 * A relative target is only meaningful from a known directory; after a
 * `cd` this cannot follow, relative writes defer and absolute ones are
 * still checked.
 */
function rootSpecWrite(command, cwd, projectRoot, isTracked = untracked) {
  return walkCommands(command, cwd).find((step) =>
    writeTargets(step.tokens).some((target) => {
      if (step.cwd !== null) return isLooseRootSpec(target, step.cwd, projectRoot, isTracked);
      return (
        pathApiFor(projectRoot).isAbsolute(target) &&
        isLooseRootSpec(target, projectRoot, projectRoot, isTracked)
      );
    }),
  );
}

/**
 * Check if a bash command line attempts to write to a root-level spec file.
 */
export function isRootSpecBashCommand(command, cwd = process.cwd()) {
  if (!command || typeof command !== 'string') return false;
  return rootSpecWrite(command, cwd, cwd) !== undefined;
}

const RELOCATION_GUIDANCE =
  'Save feature specs in `specs/<YYYY-MM-DD>-<slug>/` (spec.md, ' +
  'implementation_plan.md, tasks.md) and record them in `specs/INDEX.md`.';

/**
 * Decide whether a tool call should be blocked due to spec policy violation.
 *
 * Pure policy: it assumes the project has already been found to opt in,
 * and it learns what the repository tracks from `isTracked`, which receives
 * the absolute path of a root-level spec file.
 */
export function decide(
  toolName,
  toolInput,
  cwd = process.cwd(),
  projectRoot = cwd,
  isTracked = untracked,
) {
  if (!toolName || !toolInput) return { blocked: false };

  // 1. File modification tools (Write, Edit, NotebookEdit, write_file,
  //    replace, and the equivalents in harnesses this hasn't met yet).
  const filePath =
    toolInput.file_path ||
    toolInput.notebook_path ||
    toolInput.path ||
    toolInput.absolute_path ||
    toolInput.TargetFile ||
    toolInput.target_file ||
    toolInput.AbsolutePath;
  if (filePath && isLooseRootSpec(filePath, cwd, projectRoot, isTracked)) {
    return {
      blocked: true,
      decision: 'deny',
      reason:
        `Creating or editing root-level \`${clip(filePath)}\` is prohibited to prevent overwriting past specs. ` +
        RELOCATION_GUIDANCE,
    };
  }

  // 2. Shell execution (Bash, run_shell_command, apply_patch).
  const command = toolInput.command || toolInput.CommandLine;
  if (typeof command === 'string') {
    // Codex edits files through an `apply_patch` envelope rather than a
    // write tool, so the path only appears inside the patch header.
    for (const target of applyPatchTargets(command)) {
      if (isLooseRootSpec(target, cwd, projectRoot, isTracked)) {
        return {
          blocked: true,
          decision: 'deny',
          reason:
            `This patch writes root-level \`${clip(target)}\`, which is prohibited. ` + RELOCATION_GUIDANCE,
        };
      }
    }

    const write = rootSpecWrite(command, cwd, projectRoot, isTracked);
    if (write) {
      return {
        blocked: true,
        decision: 'deny',
        reason:
          `Command \`${clip(write.text)}\` targets a root-level spec file. Root-level specs are prohibited. ` +
          RELOCATION_GUIDANCE,
      };
    }
  }

  return { blocked: false };
}

/**
 * Ask git whether it tracks a file. Anything short of a clear yes — an
 * untracked file, no repository, no `git`, a timeout — is a no, which keeps
 * the write denied exactly as it was before this question existed.
 */
function trackedIn(projectRoot) {
  return (absolutePath) => {
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', '--', absolutePath], {
        cwd: projectRoot,
        stdio: 'ignore',
        timeout: 2000,
      });
      return true;
    } catch {
      return false;
    }
  };
}

/**
 * Decide against a normalized request, applying the opt-in gate first.
 *
 * @param {import('./lib/harness.mjs').Request} request
 */
export function inspect(request, options = {}) {
  if (!isOptedIn(request.cwd, options)) return { blocked: false };

  try {
    const projectRoot = findProjectRoot(request.cwd);
    const isTracked = trackedIn(projectRoot);
    // Every collected path gets its own pass, since `decide` inspects one.
    for (const path of request.filePaths) {
      const verdict = decide(request.toolName || 'Write', { file_path: path }, request.cwd, projectRoot, isTracked);
      if (verdict.blocked) return verdict;
    }
    if (request.command !== undefined) {
      return decide(
        request.toolName || 'Bash',
        { command: request.command },
        request.cwd,
        projectRoot,
        isTracked,
      );
    }
    return { blocked: false };
  } catch {
    return { blocked: false }; // Fail open on errors.
  }
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {}; // Fail open if payload cannot be parsed.
  }

  const dialect = resolveDialect({ argv: process.argv.slice(2), env: process.env, payload });
  if (guardsDisabled()) return emit({ blocked: false }, dialect);

  emit(inspect(normalize(payload, dialect)), dialect);
}

if (isDirectRun(import.meta.url)) {
  main();
}
