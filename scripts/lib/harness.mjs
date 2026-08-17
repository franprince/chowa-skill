/**
 * Harness dialects
 *
 * The same guard has to run under Claude Code, Gemini CLI, and Codex
 * (ChatGPT). All three run a command, hand it a JSON payload on stdin, and
 * read a verdict back — but they disagree on every detail in between:
 *
 * | | Claude Code | Gemini CLI | Codex |
 * |---|---|---|---|
 * | event | `PreToolUse` | `BeforeTool` | `PreToolUse` |
 * | shell tool | `Bash` | `run_shell_command` | `Bash`, `apply_patch` |
 * | write tools | `Write`, `Edit`, `NotebookEdit` | `write_file`, `replace` | *(none — via `apply_patch`)* |
 * | deny | `hookSpecificOutput.permissionDecision` | `{"decision":"deny"}` | as Claude |
 * | `ask` | yes | no | no |
 *
 * This module absorbs all of that, so the guards themselves decide against
 * one normalized shape and never learn which harness they are running under.
 *
 * The one thing all three agree on is exit code 2 with the reason on stderr,
 * which is what `generic` falls back to. An unrecognized harness therefore
 * still blocks — the failure mode is a coarser message, never a silent
 * allow.
 */

/** Tools that run a shell command line, across all three harnesses. */
const SHELL_TOOLS = new Set(['Bash', 'bash', 'shell', 'run_shell_command', 'apply_patch']);

/** Tools that write a file directly, across all three harnesses. */
const WRITE_TOOLS = new Set([
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'write_file',
  'replace',
  'edit_file',
]);

/**
 * Keys under which a harness passes the file a write tool targets. Claude
 * uses `file_path` (and `notebook_path` for notebooks); Gemini uses
 * `file_path`; the rest cover harnesses this hasn't been tested against,
 * which cost nothing to accept and would otherwise read as an unguarded
 * write.
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
  const toolName = typeof payload?.tool_name === 'string' ? payload.tool_name : '';
  const toolInput = payload?.tool_input ?? {};

  // Gemini's shell tool takes a `directory` relative to the workspace root;
  // a path in the command is relative to that, not to the session cwd.
  const baseCwd = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const cwd = typeof toolInput.directory === 'string' && toolInput.directory
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
