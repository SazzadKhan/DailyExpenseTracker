# Daily Expense Tracker

Local-first, vanilla-JS daily expense tracker. Optional Google Sheets sync.
No build step — open the page and it runs.

```powershell
npx --yes http-server . -p 8000 -c-1
# then visit http://127.0.0.1:8000
```

## Repository layout

```
index.html               Entry HTML. Loads CDN scripts, css, app.js, then js/main.js.
app.js                   Legacy monolith — being decomposed into js/ modules.
auth.js                  Google OAuth (sign-in / token refresh). Exposes window.auth.
storage.js               Backend adapter (local / sheets). Exposes window.storage.
sheets-api.js            Google Sheets backend. Exposes window.sheetsApi.
effects.js               Sound / haptics / ripple / confetti. Side-effect IIFE.

css/
  tokens.css             Design tokens + theme variants.
styles.css               Bulk styles (being decomposed; see docs/REFACTOR_ROADMAP.md).
effects.css              CSS for effects.js animations.

js/
  main.js                ES-module entry. Hydrates store, mounts features.
  core/                  Store, schema, constants, dom helpers, format helpers.
  services/              local-store (localStorage facade).
  features/              expenses, categories, settings, filters, charts.

docs/                    REFACTOR_ROADMAP, OAUTH_SETUP, MULTI_USER_PLAN,
                         TIMEZONE_BUG, SETUP_GUIDE.

tests/smoke.html         Open in browser to run pure-model assertions.
```

## For contributors (humans + AI)

Read [AGENTS.md](AGENTS.md) first. It documents:

- where each feature lives,
- the store / events pattern new code uses,
- the do-not-touch list (timezone helpers, sheet column order, storage keys),
- and common pitfalls.

Migration progress is tracked in [docs/REFACTOR_ROADMAP.md](docs/REFACTOR_ROADMAP.md).

## Tests

Run the smoke test by visiting `tests/smoke.html` while the server is up:
http://127.0.0.1:8000/tests/smoke.html

It exercises the pure model functions (`selectStats`, `applyFilters`,
`selectDailySeries`, etc.) without touching the DOM. Green check =
refactor didn't regress the math.

## Cloud sync

The app works offline-only by default. Sign in with Google to mirror to a
private Google Sheet. See [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md) for
how to replace the demo OAuth client ID with your own.
