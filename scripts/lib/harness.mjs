/**
 * Harness dialects
 *
 * The same guard has to run under Claude Code, Gemini CLI, Codex (ChatGPT),
 * and Antigravity. All four run a command, hand it a JSON payload on stdin,
 * and read a verdict back — but they disagree on every detail in between:
 *
 * | | Claude Code | Gemini CLI | Codex | Antigravity |
 * |---|---|---|---|---|
 * | event | `PreToolUse` | `BeforeTool` | `PreToolUse` | `PreToolUse` |
 * | shell tool | `Bash` | `run_shell_command` | `Bash`, `apply_patch` | `run_command` |
 * | write tools | `Write`, `Edit`, `NotebookEdit` | `write_file`, `replace` | *(none — via `apply_patch`)* | `write_to_file`, `replace_file_content` |
 * | tool call | `tool_name` + `tool_input` | same | same | `toolCall.name` + `toolCall.args` |
 * | argument case | `snake_case` | `snake_case` | `snake_case` | `PascalCase` |
 * | deny | `hookSpecificOutput.permissionDecision` | `{"decision":"deny"}` | as Claude | `{"decision":"deny"}` |
 * | `ask` | yes | no | no | yes |
 *
 * This module absorbs all of that, so the guards themselves decide against
 * one normalized shape and never learn which harness they are running under.
 *
 * Note that Gemini CLI and Antigravity both spell a denial `{"decision":
 * "deny"}` and yet are not interchangeable: Antigravity nests the tool call,
 * uses PascalCase arguments, and — unlike Gemini CLI — can prompt the user.
 * Sharing a key is not sharing a dialect.
 *
 * Claude Code, Gemini CLI, and Codex all treat exit code 2 with the reason
 * on stderr as a rejection, which is what `generic` falls back to. An
 * unrecognized harness therefore still blocks — the failure mode is a
 * coarser message, never a silent allow. Antigravity does not document exit
 * codes, so it is worth declaring explicitly rather than relying on that.
 */

/** Tools that run a shell command line, across every supported harness. */
const SHELL_TOOLS = new Set([
  'Bash',
  'bash',
  'shell',
  'run_shell_command', // Gemini CLI
  'apply_patch', // Codex
  'run_command', // Antigravity
]);

/** Tools that write a file directly, across every supported harness. */
const WRITE_TOOLS = new Set([
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'write_file', // Gemini CLI
  'replace', // Gemini CLI
  'edit_file',
  'write_to_file', // Antigravity
  'replace_file_content', // Antigravity
  'multi_replace_file_content', // Antigravity
]);

/**
 * Keys under which a harness passes the file a write tool targets. Claude
 * uses `file_path` (and `notebook_path` for notebooks); Gemini CLI uses
 * `file_path`; Antigravity uses PascalCase `TargetFile`. The remainder cost
 * nothing to accept and would otherwise read as an unguarded write.
 */
const PATH_KEYS = [
  'file_path',
  'notebook_path',
  'path',
  'absolute_path',
  'TargetFile',
  'target_file',
  'AbsolutePath',
];

/**
 * @typedef {object} Dialect
 * @property {string} id
 * @property {string} event - the harness's name for the pre-tool-use event
 * @property {boolean} supportsAsk - whether the harness can route a decision to the user
 * @property {(verdict: Verdict) => Rendered} render
 */

/**
 * @typedef {object} Verdict
 * @property {boolean} blocked
 * @property {'deny'|'ask'} [decision] - defaults to `deny`
 * @property {string} [reason]
 */

/**
 * @typedef {object} Rendered
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} exitCode
 */

const ALLOW = { stdout: '', stderr: '', exitCode: 0 };

/** Claude Code and Codex share an output schema; only `ask` support differs. */
function renderPermissionDecision(verdict, { supportsAsk }) {
  if (!verdict.blocked) return ALLOW;
  const decision = verdict.decision === 'ask' && supportsAsk ? 'ask' : 'deny';
  return {
    stdout: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: verdict.reason,
      },
    }),
    stderr: '',
    exitCode: 0,
  };
}

/** @type {Record<string, Dialect>} */
export const DIALECTS = {
  claude: {
    id: 'claude',
    event: 'PreToolUse',
    supportsAsk: true,
    render: (verdict) => renderPermissionDecision(verdict, { supportsAsk: true }),
  },

  codex: {
    id: 'codex',
    event: 'PreToolUse',
    supportsAsk: false,
    render: (verdict) => renderPermissionDecision(verdict, { supportsAsk: false }),
  },

  antigravity: {
    id: 'antigravity',
    event: 'PreToolUse',
    supportsAsk: true,
    render: (verdict) => {
      // Deliberately *not* `{"decision":"allow"}`. Antigravity treats that
      // as an automatic approval, so a guard with no opinion would silently
      // wave through every tool call the user would otherwise be asked
      // about — a guard must never widen permissions. An object with no
      // decision leaves the normal permission flow alone.
      if (!verdict.blocked) return { stdout: '{}', stderr: '', exitCode: 0 };
      return {
        stdout: JSON.stringify({
          // `ask` respects a permission the user already granted, which is
          // the behaviour wanted here: approving a push to `main` once for
          // a session should not mean being asked again every commit.
          decision: verdict.decision === 'ask' ? 'ask' : 'deny',
          reason: verdict.reason,
        }),
        stderr: '',
        exitCode: 0,
      };
    },
  },

  gemini: {
    id: 'gemini',
    event: 'BeforeTool',
    supportsAsk: false,
    render: (verdict) => {
      // Gemini reads an empty object as "no opinion"; its docs are explicit
      // that stdout must carry JSON and nothing else.
      if (!verdict.blocked) return { stdout: '{}', stderr: '', exitCode: 0 };
      return {
        stdout: JSON.stringify({
          decision: 'deny',
          reason: verdict.reason,
          systemMessage: `調和 (Chōwa) guard: ${verdict.reason}`,
        }),
        stderr: '',
        exitCode: 0,
      };
    },
  },

  generic: {
    id: 'generic',
    event: 'PreToolUse',
    supportsAsk: false,
    // Exit 2 with the reason on stderr is the one convention all three
    // harnesses implement, so it is what an unknown harness gets.
    render: (verdict) =>
      verdict.blocked ? { stdout: '', stderr: verdict.reason ?? 'Blocked.', exitCode: 2 } : ALLOW,
  },
};

/**
 * Which harness is this, in order of decreasing reliability: what the config
 * declared, what the environment declared, what the payload looks like.
 *
 * The shipped configs all declare `--harness`, so payload sniffing only
 * matters for hand-written ones.
 *
 * @param {{ argv?: string[], env?: Record<string, string|undefined>, payload?: object }} context
 * @returns {Dialect}
 */
export function resolveDialect({ argv = [], env = {}, payload = {} } = {}) {
  const declared = readHarnessFlag(argv) ?? env.CHOWA_HARNESS;
  if (declared && Object.hasOwn(DIALECTS, declared)) return DIALECTS[declared];

  // Antigravity is the only one that nests the tool call, which makes it
  // unambiguous without looking at the event name at all.
  if (payload?.toolCall !== undefined) return DIALECTS.antigravity;

  const event = payload?.hook_event_name;
  if (event === 'BeforeTool') return DIALECTS.gemini;
  if (event === 'PreToolUse') {
    // Codex carries per-turn identifiers Claude Code does not. Guessing wrong
    // costs an `ask` downgraded to a `deny`, never a missed block.
    const isCodex = payload?.turn_id !== undefined || payload?.tool_use_id !== undefined;
    return isCodex ? DIALECTS.codex : DIALECTS.claude;
  }

  return DIALECTS.generic;
}

function readHarnessFlag(argv) {
  const index = argv.indexOf('--harness');
  if (index !== -1 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((arg) => arg.startsWith('--harness='));
  return inline ? inline.slice('--harness='.length) : undefined;
}

/**
 * @typedef {object} Request
 * @property {string} dialect
 * @property {string} toolName
 * @property {string} cwd
 * @property {string|undefined} command - the shell command line, if this tool runs one
 * @property {string[]} filePaths - files this tool writes directly
 */

/**
 * Flatten a harness payload into the shape the guards decide against.
 *
 * @param {object} payload - the parsed stdin JSON
 * @param {Dialect} dialect
 * @returns {Request}
 */
export function normalize(payload, dialect) {
  // Antigravity nests the call as `toolCall: { name, args }`; everyone else
  // passes `tool_name` and `tool_input` side by side.
  const toolName =
    typeof payload?.toolCall?.name === 'string'
      ? payload.toolCall.name
      : typeof payload?.tool_name === 'string'
        ? payload.tool_name
        : '';
  const toolInput = payload?.toolCall?.args ?? payload?.tool_input ?? {};

  // Where the tool actually runs, in decreasing specificity: the argument
  // naming one (Antigravity's `Cwd`), the session cwd, the first workspace
  // root (Antigravity's only cwd when the tool doesn't name one).
  const baseCwd =
    firstString(toolInput.Cwd, payload?.cwd, payload?.workspacePaths?.[0]) ?? process.cwd();

  // Gemini's shell tool takes a `directory` relative to the workspace root;
  // a path in the command is relative to that, not to the session cwd.
  const cwd =
    typeof toolInput.directory === 'string' && toolInput.directory
      ? joinPosix(baseCwd, toolInput.directory)
      : baseCwd;

  // Classify by input shape as well as by name: a harness this doesn't know
  // still gets guarded as long as it passes a command or a path.
  const command =
    typeof toolInput.command === 'string'
      ? toolInput.command
      : typeof toolInput.CommandLine === 'string'
        ? toolInput.CommandLine
        : undefined;

  const filePaths = [];
  for (const key of PATH_KEYS) {
    if (typeof toolInput[key] === 'string' && toolInput[key]) filePaths.push(toolInput[key]);
  }

  return {
    dialect: dialect.id,
    toolName,
    cwd,
    command,
    filePaths,
    isShellTool: SHELL_TOOLS.has(toolName) || command !== undefined,
    isWriteTool: WRITE_TOOLS.has(toolName) || filePaths.length > 0,
  };
}

function firstString(...candidates) {
  return candidates.find((value) => typeof value === 'string' && value !== '');
}

function joinPosix(base, relative) {
  if (relative.startsWith('/')) return relative;
  return `${base.replace(/\/+$/, '')}/${relative}`;
}

/**
 * Write a verdict in the dialect's own schema and exit.
 *
 * @param {Verdict} verdict
 * @param {Dialect} dialect
 */
export function emit(verdict, dialect) {
  const { stdout, stderr, exitCode } = dialect.render(verdict);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  process.exit(exitCode);
}
