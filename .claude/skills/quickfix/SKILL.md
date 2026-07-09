---
name: quickfix
description: Fix a specific bug with minimal exploration and terse output
---

Fix the bug described in: $ARGUMENTS

Rules:
- Only read files the user named, files a stack trace points to, or direct imports of those files. Do not explore the rest of the repo.
- Make the smallest change that fixes the bug. No refactoring, no renames, no style cleanup around the fix.
- Respect AGENTS.md rules: state changes via the store, dates via `core/format.js` helpers, DOM via `$()`/`$$()` from `core/dom.js`.
- Verify by reasoning through the affected flow (and `tests/smoke.html` if relevant); do not launch the app unless asked.
- Reply with at most 3 lines: what was wrong, what changed, file:line.
