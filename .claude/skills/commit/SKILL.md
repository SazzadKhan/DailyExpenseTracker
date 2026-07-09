---
name: commit
description: Stage and commit current work with a Conventional Commits message
---

Commit the current changes.

1. Run `git status` and `git diff` to see what changed. Do not re-read files already in context.
2. If on branch `GitHub_Pages_Google_Sheets` (production), STOP and warn — commits go on a working branch.
3. Group only related changes; if the diff clearly contains two unrelated changes, ask whether to split.
4. Message format: Conventional Commits — `feat(scope): ...`, `fix(scope): ...`, `refactor: ...` — matching the style in `git log`. One short subject line; add a body only if the "why" is not obvious.
5. Commit. Do not push unless the user asked.
