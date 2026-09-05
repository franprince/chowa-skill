# Hook setup and troubleshooting

The bundled dispatcher `scripts/guard.mjs` runs push/merge and spec-location
checks before tool execution. The repository ships these adapter definitions:

| Harness | Project config | Event | Matched tools | Can ask |
|---|---|---|---|---|
| Claude Code | `.claude/settings.json` or plugin hooks | `PreToolUse` | `Bash`, `Write`, `Edit`, `NotebookEdit` | yes |
| Gemini CLI | `.gemini/settings.json` | `BeforeTool` | `run_shell_command`, `write_file`, `replace` | no |
| Codex | `.codex/hooks.json` | `PreToolUse` | `Bash`, `apply_patch` | no |
| Antigravity | `.agents/hooks.json` | `PreToolUse` | `run_command`, `write_to_file`, `replace_file_content` | yes |

These are the shipped hook contracts; use the current host's available tools
for ordinary workflow work. Confirm hook support during installation rather
than assuming every host exposing a shell tool uses these event contracts.

Resolve the plugin installation root containing `scripts/` and substitute its
absolute path below. Run from the target project for project-scope installs:

```bash
node /absolute/plugin-root/scripts/install-hooks.mjs --harness codex --scope project --dry-run
node /absolute/plugin-root/scripts/install-hooks.mjs --harness codex --scope project
```

Choose `claude`, `gemini`, `codex`, or `antigravity` as appropriate. Omit
`--scope project` for user configuration. The installer merges owned entries
without replacing unrelated hooks. Claude Code plugin installation discovers
`hooks/hooks.json` directly. A skill-only copy must have the bundled scripts
available separately before these commands can run.

Recognized blocked actions use the host's rejection schema; unknown dialects
fall back to exit code 2 and a reason on stderr. This does not guarantee that
an unknown payload shape is recognized or that an unknown host handles that
exit code. The guards intentionally defer on parsing/normalization failures.
Antigravity's no-opinion response is `{}` to retain normal host permissions.

`CHOWA_GUARDS=off` disables both guards (`0` and `false` also work). Use this
only for an explicitly authorized configuration change, such as an unattended
workflow setup, not to work around a rejected tool call.
