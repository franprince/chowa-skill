/**
 * Quote-aware shell scanning
 *
 * The guards used to split command lines with a regex on `&&|;|\|` and match
 * redirects with `/(?:>>|>)\s*(\S+)/`, neither of which knows what a quote is.
 * That cuts both ways, and the false-positive direction is the one that
 * matters: `echo "text > spec.md"` was blocked outright, while
 * `sed -i s/a/b/ spec.md` sailed through. Blocking legitimate work is the
 * worse failure (see the doctrine in `guard-push.mjs`), so quoting has to be
 * understood rather than approximated.
 *
 * This is a lexer, not a shell. It resolves quoting, escaping, operators,
 * redirect targets, heredoc bodies, and subshell parentheses — enough to
 * answer "what does this command line actually write to, and where does one
 * command end and the next begin". Command substitution, `eval`, and
 * variable expansion stay out of scope by design; the prose rule remains the
 * backstop for those.
 */

/** Characters that begin a shell operator. */
const OPERATOR_CHARS = new Set(['&', '|', ';', '<', '>', '\n']);

/** Two-character operators, checked before falling back to one character. */
const TWO_CHAR_OPERATORS = new Set(['&&', '||', '>>', '<<', '&>', '>&']);

/**
 * Interpreters that execute a heredoc body, and the builtins that read a
 * script from it (`source /dev/stdin <<EOF`). Everywhere else the body is
 * data, and reading it as commands blocks a note that merely mentions one.
 */
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'source', '.']);

/** Operators that end one command and begin another. */
const SEGMENT_OPERATORS = new Set(['&&', '||', ';', '|', '\n', '&']);

/** Operators whose following word is a file the command writes to. */
const WRITE_REDIRECTS = new Set(['>', '>>', '&>']);

/**
 * @typedef {object} Token
 * @property {string} value - the word with quotes resolved, or the operator
 * @property {boolean} quoted - whether any part of the word was quoted
 * @property {boolean} operator - whether this is an operator rather than a word
 * @property {number} start - offset of the token in the source string
 * @property {number} end - offset just past the token in the source string
 * @property {number} [opens] - subshell parentheses opened just before this word
 * @property {number} [closes] - subshell parentheses closed just after this word
 */

/** Offset just past a heredoc's terminator line, or -1 when there is none. */
function heredocEnd(command, from, { delimiter, stripTabs }) {
  let position = from;
  while (position <= command.length) {
    const newline = command.indexOf('\n', position);
    const lineEnd = newline === -1 ? command.length : newline;
    let line = command.slice(position, lineEnd).replace(/\r$/, '');
    if (stripTabs) line = line.replace(/^\t+/, '');
    if (line === delimiter) return newline === -1 ? command.length : newline + 1;
    if (newline === -1) return -1;
    position = newline + 1;
  }
  return -1;
}

/**
 * Scan a command line into words and operators, resolving quotes and escapes.
 *
 * @param {string} command
 * @returns {Token[]}
 */
export function lex(command) {
  if (typeof command !== 'string') return [];

  /** @type {Token[]} */
  const tokens = [];
  let word = '';
  let quoted = false;
  let started = false;
  let wordStart = 0;
  let i = 0;

  // Parentheses that start a word open a subshell and are dropped from it;
  // those inside a word (`$(`, `$((`) stay, and so do the ones closing them.
  let pendingOpens = 0;
  let opens = 0;
  let closes = 0;
  let innerDepth = 0;

  /** @type {{ stripTabs: boolean } | null} */
  let awaitingDelimiter = null;
  /** @type {{ delimiter: string, stripTabs: boolean }[]} */
  let heredocs = [];

  const flushWord = (end) => {
    if (!started) return;
    tokens.push({ value: word, quoted, operator: false, start: wordStart, end, opens, closes });
    if (awaitingDelimiter) heredocs.push({ delimiter: word, stripTabs: awaitingDelimiter.stripTabs });
    awaitingDelimiter = null;
    word = '';
    quoted = false;
    started = false;
    opens = 0;
    closes = 0;
  };

  const beginWord = () => {
    if (!started) {
      started = true;
      wordStart = i;
      opens = pendingOpens;
      pendingOpens = 0;
    }
  };

  const closeSubshell = () => {
    if (started) {
      closes += 1;
      return;
    }
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
      if (!tokens[index].operator) {
        tokens[index].closes += 1;
        return;
      }
    }
  };

  /** Does the line just scanned run a shell that could read the heredoc? */
  const lineRunsShell = () => {
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
      const token = tokens[index];
      if (token.operator && token.value === '\n') return false;
      if (!token.operator && SHELLS.has(token.value.split('/').pop())) return true;
    }
    return false;
  };

  while (i < command.length) {
    const char = command[i];

    if (char === '\\') {
      beginWord();
      if (i + 1 < command.length) word += command[i + 1];
      i += 2;
      continue;
    }

    if (char === "'") {
      beginWord();
      quoted = true;
      i += 1;
      while (i < command.length && command[i] !== "'") {
        word += command[i];
        i += 1;
      }
      i += 1; // closing quote, or end of input on an unterminated quote
      continue;
    }

    if (char === '"') {
      beginWord();
      quoted = true;
      i += 1;
      while (i < command.length && command[i] !== '"') {
        if (command[i] === '\\' && i + 1 < command.length) {
          word += command[i + 1];
          i += 2;
          continue;
        }
        word += command[i];
        i += 1;
      }
      i += 1;
      continue;
    }

    if (char === ' ' || char === '\t' || char === '\r') {
      flushWord(i);
      i += 1;
      continue;
    }

    if (OPERATOR_CHARS.has(char)) {
      // A bare file-descriptor number belongs to the operator, not to the
      // preceding word: `2>&1` redirects fd 2, it is not a word `2`.
      if (started && !quoted && /^\d+$/.test(word) && (char === '>' || char === '<')) {
        word = '';
        started = false;
      }
      flushWord(i);
      awaitingDelimiter = null;

      const start = i;

      if (char === '\n' && heredocs.length > 0) {
        // Skip the bodies only when every terminator is really there:
        // `$((1 << 2))` also lexes as `<<`, and must not swallow the rest.
        let cursor = lineRunsShell() ? -1 : i + 1;
        for (const heredoc of heredocs) {
          cursor = cursor === -1 ? -1 : heredocEnd(command, cursor, heredoc);
        }
        heredocs = [];
        if (cursor !== -1) {
          i = cursor;
          tokens.push({ value: '\n', quoted: false, operator: true, start, end: i });
          continue;
        }
      }

      let operator = char;
      const pair = char + (command[i + 1] ?? '');
      if (TWO_CHAR_OPERATORS.has(pair)) {
        operator = pair;
        i += 1;
      }
      i += 1;

      if (operator === '<<') {
        if (command[i] === '<') {
          operator = '<<<'; // a here-string: its word is data, not a delimiter
          i += 1;
        } else {
          const stripTabs = command[i] === '-';
          if (stripTabs) i += 1;
          awaitingDelimiter = { stripTabs };
        }
      }

      tokens.push({ value: operator, quoted: false, operator: true, start, end: i });
      continue;
    }

    if (char === '(') {
      if (!started) {
        pendingOpens += 1;
        i += 1;
        continue;
      }
      innerDepth += 1;
    } else if (char === ')') {
      if (innerDepth === 0) {
        closeSubshell();
        i += 1;
        continue;
      }
      innerDepth -= 1;
    }

    beginWord();
    word += char;
    i += 1;
  }

  flushWord(i);
  return tokens;
}

/**
 * @typedef {object} Segment
 * @property {Token[]} tokens - words and non-separating operators
 * @property {string} text - the original source text of this segment
 * @property {string|null} before - the operator that joins this command to
 *   the one before it (`&&`, `||`, `;`, `|`, `&`, or a newline); `null` for
 *   the first command
 */

/**
 * Split a command line into the individual commands it runs.
 *
 * @param {string} command
 * @returns {Segment[]}
 */
export function splitSegments(command) {
  if (typeof command !== 'string') return [];

  /** @type {Segment[]} */
  const segments = [];
  /** @type {Token[]} */
  let current = [];
  let start = 0;
  /** @type {string|null} */
  let before = null;

  const flush = (end) => {
    const text = command.slice(start, end).trim();
    if (current.length > 0) segments.push({ tokens: current, text, before });
    current = [];
  };

  for (const token of lex(command)) {
    if (token.operator && SEGMENT_OPERATORS.has(token.value)) {
      const hadCommand = current.length > 0;
      flush(token.start);
      start = token.end;
      // Between two commands only the first operator joins them: the
      // newline after `&&` is a continuation, not a new separator.
      if (hadCommand) before = token.value;
      continue;
    }
    current.push(token);
  }
  flush(command.length);

  return segments;
}

/**
 * The words a segment redirects output into (`> f`, `>> f`, `&> f`).
 *
 * @param {Token[]} tokens
 * @returns {string[]}
 */
export function redirectTargets(tokens) {
  const targets = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (!tokens[i].operator || !WRITE_REDIRECTS.has(tokens[i].value)) continue;
    const target = tokens[i + 1];
    if (target && !target.operator) targets.push(target.value);
  }
  return targets;
}

/** The words of a segment, with operators and their targets removed. */
export function words(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].operator) {
      // Skip the operator and, for redirects, the filename it consumes.
      if (tokens[i + 1] && !tokens[i + 1].operator) i += 1;
      continue;
    }
    result.push(tokens[i].value);
  }
  return result;
}

/** Shorten text quoted back in a reason, so one huge command stays readable. */
export function clip(text, limit = 200) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * File paths an `apply_patch` envelope writes to.
 *
 * Codex has no file-write tool that fires `PreToolUse` — edits arrive as a
 * shell payload wrapping this envelope, so it is the only place a path is
 * visible on that harness.
 *
 * @param {string} command
 * @returns {string[]}
 */
export function applyPatchTargets(command) {
  if (typeof command !== 'string' || !command.includes('***')) return [];

  const targets = [];
  const pattern = /^\s*\*\*\*\s+(?:Add File|Update File|Delete File|Move to):\s*(.+?)\s*$/gm;
  for (const match of command.matchAll(pattern)) {
    targets.push(match[1]);
  }
  return targets;
}
