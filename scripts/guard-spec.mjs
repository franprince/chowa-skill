#!/usr/bin/env node
/**
 * Spec protection (pre-tool-use hook)
 *
 * Prevents agents from creating or modifying loose root-level spec files
 * (`spec.md`, `implementation_plan.md`, or `tasks.md`). Enforces that specs
 * must live inside dedicated feature directories under
 * `specs/<YYYY-MM-DD>-<slug>/` and be recorded in `specs/INDEX.md`.
 *
 * Iterating on specs is supported by editing files inside `specs/<YYYY-MM-DD>-<slug>/`.
 *
 * Two things scope this deliberately:
 *
 * 1. **It only applies where the convention does.** A root-level `tasks.md`
 *    is an ordinary file in most repositories, and this guard has no
 *    business rejecting it in a project that never adopted the spec →
 *    plan → execute layout. `inspect` checks opt-in the same way SKILL.md
 *    Step 0 does; `decide` stays pure policy so it can be tested without a
 *    project around it.
 * 2. **It denies rather than asks.** The reason text tells the agent
 *    exactly where the file belongs instead, so it can correct itself on
 *    the next call — routing a path convention to the user would be noise.
 *    The push guard makes the opposite call, for the opposite reason.
 */

import { relative, resolve } from 'node:path';

import { isDirectRun } from './lib/direct-run.mjs';
import { emit, normalize, resolveDialect } from './lib/harness.mjs';
import { guardsDisabled, isOptedIn } from './lib/opt-in.mjs';
import { applyPatchTargets, redirectTargets, splitSegments, words } from './lib/shell.mjs';

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
export function isRootSpecPath(targetPath, cwd = process.cwd()) {
  if (!targetPath || typeof targetPath !== 'string') return false;

  const absoluteTarget = resolve(cwd, targetPath);
  const relativeTarget = relative(cwd, absoluteTarget);

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

/**
 * Check if a bash command segment attempts to write to a root-level spec file.
 */
export function isRootSpecBashCommand(segment, cwd = process.cwd()) {
  if (!segment || typeof segment !== 'string') return false;

  return splitSegments(segment).some((parsed) =>
    writeTargets(parsed.tokens).some((target) => isRootSpecPath(target, cwd)),
  );
}

const RELOCATION_GUIDANCE =
  'Save feature specs in `specs/<YYYY-MM-DD>-<slug>/` (spec.md, ' +
  'implementation_plan.md, tasks.md) and record them in `specs/INDEX.md`.';

/**
 * Decide whether a tool call should be blocked due to spec policy violation.
 *
 * Pure policy: it assumes the project has already been found to opt in.
 */
export function decide(toolName, toolInput, cwd = process.cwd()) {
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
  if (filePath && isRootSpecPath(filePath, cwd)) {
    return {
      blocked: true,
      decision: 'deny',
      reason:
        `Creating or editing root-level \`${filePath}\` is prohibited to prevent overwriting past specs. ` +
        RELOCATION_GUIDANCE,
    };
  }

  // 2. Shell execution (Bash, run_shell_command, apply_patch).
  const command = toolInput.command || toolInput.CommandLine;
  if (typeof command === 'string') {
    // Codex edits files through an `apply_patch` envelope rather than a
    // write tool, so the path only appears inside the patch header.
    for (const target of applyPatchTargets(command)) {
      if (isRootSpecPath(target, cwd)) {
        return {
          blocked: true,
          decision: 'deny',
          reason:
            `This patch writes root-level \`${target}\`, which is prohibited. ` + RELOCATION_GUIDANCE,
        };
      }
    }

    for (const segment of splitSegments(command)) {
      if (writeTargets(segment.tokens).some((target) => isRootSpecPath(target, cwd))) {
        return {
          blocked: true,
          decision: 'deny',
          reason:
            `Command \`${segment.text}\` targets a root-level spec file. Root-level specs are prohibited. ` +
            RELOCATION_GUIDANCE,
        };
      }
    }
  }

  return { blocked: false };
}

/**
 * Decide against a normalized request, applying the opt-in gate first.
 *
 * @param {import('./lib/harness.mjs').Request} request
 */
export function inspect(request, options = {}) {
  if (!isOptedIn(request.cwd, options)) return { blocked: false };

  try {
    // Every collected path gets its own pass, since `decide` inspects one.
    for (const path of request.filePaths) {
      const verdict = decide(request.toolName || 'Write', { file_path: path }, request.cwd);
      if (verdict.blocked) return verdict;
    }
    if (request.command !== undefined) {
      return decide(request.toolName || 'Bash', { command: request.command }, request.cwd);
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
