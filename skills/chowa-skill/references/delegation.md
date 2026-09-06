# Mechanical delegation

Delegate a mechanical task only when its exact output or transformation rule
is known and its size/repetition justifies the extra call. Handle trivial
edits inline. Keep unresolved design decisions in the primary session; follow
repository guidance on model choice and the user's requests for direct work.

The optional Claude Code plugin supplies `chowa-skill-mechanical`. For a
standalone skill or another host, use native delegation with a permitted model
when available; otherwise execute inline. Never assume a named agent or model
exists across hosts.

Send the rule, owned files, relevant excerpts, constraints, and verification
criteria. Avoid forwarding unrelated history; batch changes governed by the
same rule. Require a concise report of changed files, applied changes, checks,
and unresolved issues. The subagent stops if a new design decision is needed.
The primary agent remains responsible for reviewing the diff and verifying
the result; use the report to target further inspection.
