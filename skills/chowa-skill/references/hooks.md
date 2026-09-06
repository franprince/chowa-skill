# Hook setup and troubleshooting

The bundled dispatcher `scripts/guard.mjs` runs push/merge and spec-location
checks before tool execution. The repository ships these adapter definitions:

| Harness | Project config | Event | Matched tools | Can ask |
|---|---|---|---|---|
| Claude Code | `.claude/settings.json` or plugin hooks | `PreToolUse` | `Bash`, `PowerShell`, `Write`, `Edit`, `NotebookEdit` | yes |
| Gemini CLI | `.gemini/settings.json` | `BeforeTool` | `run_shell_command`, `write_file`, `replace` | no |
| Codex | `.codex/hooks.json` | `PreToolUse` | `Bash`, `apply_patch` | no |
| Antigravity | `.agents/hooks.json` | `PreToolUse` | `run_command`, `write_to_file`, `replace_file_content` | yes |

These are the shipped hook contracts; use the current host's available tools
for ordinary workflow work. Confirm hook support during installation rather
than assuming every host exposing a shell tool uses these event contracts.

Resolve the skill directory containing SKILL.md and substitute its absolute
path below. Run from the target project for project-scope installs:

```bash
node /absolute/skill-root/scripts/install-hooks.mjs --harness codex --scope project --dry-run
node /absolute/skill-root/scripts/install-hooks.mjs --harness codex --scope project
```

Choose `claude`, `gemini`, `codex`, or `antigravity` as appropriate. Omit
`--scope project` for user configuration. The installer merges owned entries
without replacing unrelated hooks. Claude Code plugin installation discovers
`hooks/hooks.json` directly. Standalone skill installations require this
explicit hook setup; skill discovery alone does not activate hooks.

For Codex, review and trust the installed commands with `/hooks`; changed hook
commands are skipped until trusted. Project configuration also requires project
trust. User installs respect `CODEX_HOME` when set. Reload or restart the host
when its settings require it, then confirm the hooks appear in its hook viewer.
Gemini disables project hooks and workspace skill discovery in untrusted folders;
review and trust the intended project through its normal trust flow.
Codex canonicalizes shell calls to `Bash` and patch calls to `apply_patch`;
Gemini uses `run_shell_command` with `dir_path` for its working directory.
Claude includes `tool_use_id` too, so that field cannot identify Codex.

Adapter contracts: [Claude Code](https://code.claude.com/docs/en/hooks),
[Codex](https://learn.chatgpt.com/docs/hooks), and
[Gemini CLI](https://geminicli.com/docs/hooks/reference/). Hooks inspect recognized
commands and paths; they are workflow checks, not a complete shell sandbox.

Recognized blocked actions use the host's rejection schema; unknown dialects
fall back to exit code 2 and a reason on stderr. This does not guarantee that
an unknown payload shape is recognized or that an unknown host handles that
exit code. The guards intentionally defer on parsing/normalization failures.
Antigravity's no-opinion response is `{}` to retain normal host permissions.

`CHOWA_GUARDS=off` disables both guards (`0` and `false` also work). Use this
only for an explicitly authorized configuration change, such as an unattended
workflow setup, not to work around a rejected tool call.
