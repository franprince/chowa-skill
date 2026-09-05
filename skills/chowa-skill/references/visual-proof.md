# Visual proof and Storybook collection

Apply this procedure only when the user requests visual proof or project
instructions require it. Within that scope, include `### Visual Proof` after
`### Summary` in the PR description. Attach actual rendered evidence for
visual changes. For non-visual changes, write `N/A (non-visual change)`.

Styling, frontend components, graphic assets, layout templates, and themes
are candidates for visual review; inspect the actual diff. A behavior-only
change in a UI file can be non-visual. Use screenshots or before/after tables
with image links accessible to the intended reviewer. If evidence cannot be
captured or shared, report the limitation; do not claim verification or leave
placeholder images. Upload only within the user's authorized scope.

## Storybook collector (on request)

Run the bundled collector only when the user explicitly requests visual proof
for a Storybook-backed UI. General visual-proof opt-in or a styling diff does
not automatically authorize running this collector.

Keep the target project as CWD. Resolve the plugin root containing `scripts/`
and substitute its verified absolute path:

```bash
node /absolute/plugin-root/scripts/storybook-proof.mjs --base <base-ref>
```

The project must already have Storybook and Playwright configured. The helper
captures the base in a temporary worktree and the working tree as the after
state, selecting stories associated with changed components. It prints a
Markdown comparison table. Review its output and image accessibility before
using the table in a PR. Report missing prerequisites; do not install them
as an implied part of this procedure.
