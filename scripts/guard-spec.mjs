#!/usr/bin/env node
/**
 * Spec protection (PreToolUse hook)
 *
 * Prevents agents from creating or modifying loose root-level spec files
 * (`spec.md`, `implementation_plan.md`, or `tasks.md`). Enforces that specs
 * must live inside dedicated feature directories under
 * `specs/<YYYY-MM-DD>-<slug>/` and be recorded in `specs/INDEX.md`.
 *
 * Iterating on specs is supported by editing files inside `specs/<YYYY-MM-DD>-<slug>/`.
 */

import { relative, resolve } from 'node:path';

/** Shell separators that start a new command segment. */
const SEGMENT_SPLIT = /(?:&&|\|\||;|\||\n)/;

/**
 * Check if a file path refers to a loose root-level spec or implementation plan.
 * Returns true if the target is root-level `spec.md` or `implementation_plan.md`.
 */
export function isRootSpecPath(targetPath, cwd = process.cwd()) {
  if (!targetPath || typeof targetPath !== 'string') return false;

  const absoluteTarget = resolve(cwd, targetPath);
  const relativeTarget = relative(cwd, absoluteTarget);

  // Normalizes paths like `spec.md` or `./spec.md` to `spec.md`
  const lower = relativeTarget.toLowerCase();
  return lower === 'spec.md' || lower === 'implementation_plan.md' || lower === 'tasks.md';
}

/**
 * Split a bash command string into individual segments.
 */
function segments(command) {
  return command.split(SEGMENT_SPLIT).map((segment) => segment.trim());
}

/**
 * Check if a bash command segment attempts to write to a root-level spec file.
 */
export function isRootSpecBashCommand(segment, cwd = process.cwd()) {
  if (!segment || typeof segment !== 'string') return false;

  // Check output redirection: `>> spec.md`, `> implementation_plan.md`
  const redirectMatch = segment.match(/(?:>>|>)\s*(\S+)/);
  if (redirectMatch && isRootSpecPath(redirectMatch[1], cwd)) {
    return true;
  }

  // Check file creation / manipulation commands: touch, cp, mv, cat
  const tokens = segment.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const cmd = tokens[0];
    if (['touch', 'cp', 'mv', 'tee'].includes(cmd)) {
      const target = tokens[tokens.length - 1];
      if (isRootSpecPath(target, cwd)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Decide whether a tool call should be blocked due to spec policy violation.
 */
export function decide(toolName, toolInput, cwd = process.cwd()) {
  if (!toolName || !toolInput) return { blocked: false };

  // 1. File modification tools (Write, Edit, FileWrite, FileEdit, replace_file_content, etc.)
  const filePath = toolInput.file_path || toolInput.path || toolInput.TargetFile || toolInput.target_file || toolInput.AbsolutePath;
  if (filePath && isRootSpecPath(filePath, cwd)) {
    return {
      blocked: true,
      reason:
        `Creating or editing root-level \`${filePath}\` is prohibited to prevent overwriting past specs. ` +
        `Save feature specs in \`specs/<YYYY-MM-DD>-<slug>/\` (spec.md, implementation_plan.md, tasks.md) and record them in \`specs/INDEX.md\`.`,
    };
  }

  // 2. Bash tool execution
  const command = toolInput.command || toolInput.CommandLine;
  if (toolName === 'Bash' && typeof command === 'string') {
    for (const segment of segments(command)) {
      if (isRootSpecBashCommand(segment, cwd)) {
        return {
          blocked: true,
          reason:
            `Command \`${segment}\` targets a root-level spec file. Root-level specs are prohibited. ` +
            `Save feature specs in \`specs/<YYYY-MM-DD>-<slug>/\` (spec.md, implementation_plan.md, tasks.md) and record them in \`specs/INDEX.md\`.`,
        };
      }
    }
  }

  return { blocked: false };
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
    return defer(); // Fail open if payload cannot be parsed.
  }

  const toolName = payload?.tool_name;
  const toolInput = payload?.tool_input;
  const cwd = payload?.cwd || process.cwd();

  let verdict;
  try {
    verdict = decide(toolName, toolInput, cwd);
  } catch {
    return defer(); // Fail open on errors.
  }

  if (!verdict.blocked) return defer();

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: verdict.reason,
      },
    }),
  );
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
