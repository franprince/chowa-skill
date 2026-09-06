#!/usr/bin/env node
/**
 * Guard dispatcher (pre-tool-use hook)
 *
 * One entry point for every guard, on every harness.
 *
 * Registering each guard separately meant a harness spawned one Node
 * process per guard per tool call — two interpreters started, two payloads
 * parsed, for a decision that is almost always "no opinion". Dispatching
 * from a single process halves that on every shell command the agent runs.
 *
 * Harnesses declare which dialect they speak on the command line
 * (`--harness claude|gemini|codex`); see `lib/harness.mjs` for what happens
 * when nothing declares one.
 *
 * Usage (from a harness hook configuration):
 *   node /path/to/scripts/guard.mjs --harness claude
 */

import { isDirectRun } from './lib/direct-run.mjs';
import { emit, normalize, resolveDialect } from './lib/harness.mjs';
import { guardsDisabled } from './lib/opt-in.mjs';
import { inspect as inspectPush } from './guard-push.mjs';
import { inspect as inspectSpec } from './guard-spec.mjs';

/** Every guard the dispatcher runs, in the order their reasons read best. */
export const GUARDS = [
  { name: 'push', inspect: inspectPush },
  { name: 'spec', inspect: inspectSpec },
];

/**
 * Run every guard and combine what they found.
 *
 * A single tool call can violate more than one rule, and reporting only the
 * first would send the agent to fix one problem and straight back into the
 * other. Reasons are joined; the stricter decision wins, since `deny` is
 * the one the agent can act on without the user.
 *
 * @param {import('./lib/harness.mjs').Request} request
 * @param {typeof GUARDS} [guards]
 * @returns {import('./lib/harness.mjs').Verdict}
 */
export function inspectAll(request, guards = GUARDS) {
  const blocking = [];

  for (const guard of guards) {
    let verdict;
    try {
      verdict = guard.inspect(request);
    } catch {
      continue; // A broken guard defers; it never takes the others down.
    }
    if (verdict?.blocked) blocking.push(verdict);
  }

  if (blocking.length === 0) return { blocked: false };

  return {
    blocked: true,
    decision: blocking.some((verdict) => verdict.decision !== 'ask') ? 'deny' : 'ask',
    reason: blocking.map((verdict) => verdict.reason).join(' '),
  };
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

  let request;
  try {
    request = normalize(payload, dialect);
  } catch {
    return emit({ blocked: false }, dialect);
  }

  emit(inspectAll(request), dialect);
}

if (isDirectRun(import.meta.url)) {
  main();
}
