# DailyExpenseTracker — Claude Code guide

@AGENTS.md

## Quick commands

```powershell
# Run locally (no build step — edit, refresh browser)
npx --yes http-server . -p 8000 -c-1
# then open http://127.0.0.1:8000
```

- Smoke tests: open `tests/smoke.html` in the browser (manual: `tests/manual-smoke.html`).
- Deploy: GitHub Pages serves the repo root; branch `GitHub_Pages_Google_Sheets` is production — never commit to it directly.

## Working style (token-efficient)

- Search `js/features/<area>/` first; each feature is self-contained. Do not read the whole `js/` tree to find something.
- In `docs/`, only `REFACTOR_ROADMAP.md`, `TIMEZONE_BUG.md`, `OAUTH_SETUP.md`, and `PARSER_LIMITATIONS.md` are code-relevant. Don't read anything else there (business plans, pitches, strategy notes, feature/plan write-ups) unless the task is explicitly about those docs — they are large and irrelevant to code work.
- Chart.js comes from a CDN `<script>` in `index.html`; there is no `package.json` and there must never be a build step or npm dependency.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, scope optional), matching `git log`.
- Prefer the smallest possible diff. No drive-by refactors.
