# Implementation plan

1. Simplify the workflow template and renderer to one skill plus conditional
   references. Generate runtime script and hook copies inside the skill directory.
2. Correct host payload detection and working-directory normalization. Preserve
   host-specific permission semantics, safely quote installed commands, and
   document trust/reload requirements.
3. Replace installation instructions with native discovery guidance for all three
   hosts. Remove obsolete distribution references and mark superseded historical
   requirements clearly. Update the repository's public description.
4. Exercise native payload fixtures, isolated copied-skill helpers, installation
   idempotence and quoting; run the full suite, generation checks, skill validation,
   and available native package validation. Record any live-host testing limits.

The user authorized this scope. Runtime helpers retain their canonical sources
under scripts/ and hooks/; generated copies avoid dependencies outside the skill.
Version metadata follows the repository's automatic release process on merge.

## Verification results

- Node.js 22.22.2 on Linux: all 129 repository tests pass. The isolated-copy
  regression invokes installed hook commands for Claude, Codex, and Gemini,
  covering protected pushes, root spec writes, permitted feature paths,
  idempotent installation, and paths containing spaces and shell syntax.
- Gemini dir_path handles relative and absolute working directories. Spec checks
  resolve paths against the workflow root even when execution starts below it.
- Unrelated hooks with generic guard filenames are preserved. Windows path
  normalization and installation-path quoting have unit coverage.
- All 18 generated artifacts pass --check. The core is 10,092 characters
  (approximately 2,523 tokens at characters / 4), below its 12,000 limit.
- Skill-creator validation passes. Claude Code 2.1.243 validates the skill,
  agent directory, plugin manifest, and marketplace without warnings.
- Codex 0.153.3 app-server skills/list discovers the isolated .agents/skills
  installation exactly once and reports it enabled.
- Gemini CLI 0.58.0, installed temporarily without lifecycle scripts, accepts
  a native workspace skill install. skills list reports the skill enabled in
  the trusted temporary workspace; the untrusted case correctly discovers none.
- Repository-wide searches find no obsolete product commands, template variants,
  external product links, or removed integration identifiers in tracked content.
- The public repository About description was updated and read back successfully.

Native checks used temporary workspaces without modifying personal skill installs
or starting model conversations. Hook subprocess contracts were tested, but full
interactive permission flows and model-driven execution on all hosts were not.
Windows/macOS host sessions were not run; no cross-platform end-to-end claim is
made. Optional hooks do not parse every shell language construct.

Historical records for retired product requirements retain their original dated
links, explicit superseded status, and concise retained requirements. Their prior
bodies remain in Git history. The feature commit is eligible for the automatic
minor release bump on merge; no competing manual version bump is introduced.
