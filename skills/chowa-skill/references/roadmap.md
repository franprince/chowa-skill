# Roadmap visualization

Use this procedure when asked to visualize the roadmap or development history.
Read `specs/INDEX.md` first. Default to the index's date, slug, status, and
summary for a complete lean timeline. If the user requests narrative depth,
read only the Problem Statement/Goals sections of relevant specs. Keep added
spec context within roughly 12,000 characters per pass; prioritize requested
features and summarize before expanding further. A quick request stays lean.

Build a chronological timeline with status colors and filters. Add expandable
narrative when collected. Show experimental/stability markers only when that
metadata is available in the index or already-read spec sections; lean mode
does not require opening specs just to retrieve markers. Use the project's
status vocabulary, including superseded links when present.

Give the page a deliberate palette, typography, and layout. Produce a
self-contained HTML file with inline CSS/JS, no external requests, and light
and dark themes via `prefers-color-scheme`. Write it to a local scratch path
outside `specs/` and leave it uncommitted. Open it with the host's available
local preview or `xdg-open`/`open`/`start`. If no viewer is available, report
the file path. Do not upload or publish it without a separate request.
