# AGENTS.md — Contributor & AI Agent Guide

> Read this **before** editing the codebase. It is short on purpose.

## What this app is

A vanilla-JS (no framework, no build step) **daily expense tracker** with:

- Local-first storage in `localStorage`.
- Optional Google Sheets cloud sync (per-user OAuth).
- Multiple themes, charts (Chart.js via CDN), CSV import/export.

Run it locally:

```powershell
npx --yes http-server . -p 8000 -c-1
# then open http://127.0.0.1:8000
```

There is **no build step**. Edit files, refresh the browser.

## Codebase status

The repo is in the middle of a refactor from a monolithic [app.js](app.js)
(~92 KB) into ES modules under [js/](js). Until the refactor is finished:

- **Old code:** [app.js](app.js), [auth.js](auth.js), [storage.js](storage.js),
  [sheets-api.js](sheets-api.js), [effects.js](effects.js). Loaded via classic
  `<script>` in [index.html](index.html). Uses globals on `window`.
- **New code:** [js/core/](js/core), [js/services/](js/services),
  [js/features/](js/features). ES modules, loaded via
  `<script type="module" src="js/main.js">`.

See [docs/REFACTOR_ROADMAP.md](docs/REFACTOR_ROADMAP.md) for the migration plan
and which features have moved.

## File map (target structure)

```
js/
  main.js               app entry; imports features and wires them
  core/
    constants.js        EMOJI_LIST, DEFAULT_CATEGORIES, CURRENCIES, STORAGE_KEYS
    schema.js           JSDoc typedefs (Expense, Category, Settings); SCHEMA_VERSION
    store.js            single reactive state store (getState, setState, subscribe)
    events.js           string constants for store events
    dom.js              $, $$, on(), delegate(), html`...` helper
    format.js           formatCurrency, formatDate, getLocalDateString, normalizeDateString
    log.js              prefixed console logger
  services/
    auth.js             Google OAuth (window.auth)
    storage.js          backend facade (window.storage)
    sheets-api.js       Google Sheets backend (window.sheetsApi)
  features/
    expenses/           CRUD, table/card render, recent list
    categories/         category + subcategory CRUD, emoji picker
    charts/             daily/monthly/category Chart.js wrappers
    filters/            filter state + filtered selectors
    settings/           settings tabs, theme, currency, budget
    effects/            sound, haptics, ripple, confetti
css/
  tokens.css   base.css   layout.css   components/*.css
docs/
  REFACTOR_ROADMAP.md   MULTI_USER_PLAN.md   OAUTH_SETUP.md   ...
```

## Rules for editing

1. **Never duplicate `app.js`.** If you need a feature that hasn't been
   extracted yet, move the relevant block from `app.js` into the right
   `js/features/<area>/` module, then delete it from `app.js`.
2. **All new code must be ES modules** (`import` / `export`). Do not add to
   `window.*` globals. The three legacy services (`auth`, `storage`,
   `sheetsApi`) are the only sanctioned globals and will be wrapped later.
3. **State changes go through the store.** Read with `store.getState()`,
   write with `store.update(patch)` or domain actions
   (e.g. `addExpense(exp)`). Never mutate `state.expenses` in place.
4. **Render functions subscribe** to the store; they do **not** get called
   manually after a mutation. If a UI doesn't refresh, fix the subscription,
   don't add another manual `renderX()` call.
5. **Dates are local `YYYY-MM-DD` strings.** Use `getLocalDateString(date)`
   and `normalizeDateString(str)` from `core/format.js`.
   See [docs/TIMEZONE_BUG.md](docs/TIMEZONE_BUG.md) for why. Do not use
   `new Date(yyyyMmDd)` directly — it parses as UTC and shifts the day.
6. **Currency formatting:** always `formatCurrency(amount, settings.currency)`.
7. **Money is `Number`.** Do not store strings. Validate with
   `Number.isFinite` and `>= 0` at boundaries (form input, CSV import,
   cloud pull). Don't add validation in the middle of pipelines.
8. **DOM lookups:** use `$('#id')` and `$$('.cls')` from `core/dom.js`. Do
   not sprinkle `document.getElementById` in feature code.
9. **One feature = one folder.** Each folder owns its own CSS file under
   `css/components/` and a single entry module that exports a `mount(root)`
   function called from `js/main.js`.
10. **No new top-level files** unless absolutely necessary. Put docs in
    `docs/`, code under `js/` or `css/`.

## Do-not-touch list

- `window.GOOGLE_OAUTH_CLIENT_ID` in [index.html](index.html) — replacing it
  breaks sign-in for existing users.
- Timezone helpers in `core/format.js` (`getLocalDateString`,
  `normalizeDateString`). They look redundant but fix a real bug
  ([docs/TIMEZONE_BUG.md](docs/TIMEZONE_BUG.md)).
- Sheet column order in [sheets-api.js](sheets-api.js):
  `[id, date, category, subcategory, amount, description, currency, timestamp, type]`.
  Existing users have data in this layout.
- `localStorage` key names in `STORAGE_KEYS` (see `core/constants.js`).
  Changing them silently loses user data; bump `SCHEMA_VERSION` and write a
  migration in `core/schema.js` instead.

## Data shapes

Authoritative JSDoc typedefs live in [js/core/schema.js](js/core/schema.js).
Summary:

```js
/** @typedef {{ id:string, type:'expense'|'income', date:string,
 *              category:string, subcategory:string, amount:number,
 *              description:string, currency:string }} Expense */

/** @typedef {{ [name:string]: { icon:string, subcategories:string[] } }} Categories */

/** @typedef {{ currency:string, monthlyBudget:number, warningThreshold:number,
 *              enableNotifications:boolean, theme:'dark'|'panda'|'peaceful'|'edgy'
 *           }} Settings */
```

## Common pitfalls (read before editing)

- **"My UI didn't update"** → you mutated state directly instead of going
  through the store, or your render fn isn't subscribed. Don't add manual
  `render*()` calls.
- **"Dates are off by one"** → you used `new Date('2026-05-08')` somewhere.
  Use the formatters in `core/format.js`.
- **"Cloud sync overwrote local data"** → on first sign-in, the app prompts
  to migrate. Don't auto-push without that prompt.
- **CSS rename broke JS** → JS should never select by visual class. Use
  `data-role="..."` attributes for JS hooks.

## When in doubt

Make the smallest possible change. If a function is in `app.js`, prefer
moving it into the correct module **before** modifying it, so the diff
shows up in the right place.
