# Refactor Roadmap

The repo is migrating from a single `app.js` (~92 KB) to small ES modules
under `js/`. The legacy code keeps working during the migration; new code
is added alongside it and feature blocks are moved over one at a time.

## Status

| Phase | Scope                                              | Status |
|-------|----------------------------------------------------|--------|
| 1     | Foundation: `AGENTS.md`, `js/core/*`, local-store  | ✅ done |
| 2     | Extract **expenses** read-side (stats + recent)    | ✅ done |
| 3     | Extract **settings** (theme/currency) + category dropdowns | ✅ done |
| 4     | Filters store-mirror + pure chart selectors        | ✅ done |
| 5     | Extract design tokens into `css/tokens.css`        | ✅ done (partial) |
| 6     | ESLint + Prettier + JSDoc typedefs + smoke test    | ⬜ todo |

## Phase 5 notes

Only the `:root` + `[data-theme="..."]` blocks have been pulled into
[../css/tokens.css](../css/tokens.css). The same rules still appear at the
top of `styles.css`. Since both files define identical values, behavior is
unchanged. Leaving the duplicate avoids a risky 71 KB rewrite; the
`styles.css` copy can be deleted once a smoke test (Phase 6) is in place.

Future component CSS belongs under `css/components/<component>.css`,
imported via a `<link>` in `index.html`. Each feature module should own
its component file, e.g. `css/components/expenses.css` paired with
`js/features/expenses/`.

## Migration recipe (per feature)

When extracting a block from `app.js` into `js/features/<area>/`:

1. **Create** `js/features/<area>/<area>.model.js` for pure data ops
   (no DOM): `addExpense(state, exp)`, `updateExpense`, `deleteExpense`, etc.
   They take/return data; they do NOT touch globals.
2. **Create** `js/features/<area>/<area>.ui.js` for DOM render +
   event handlers. It imports `store` and subscribes to the relevant
   `EVENTS.*`.
3. **Create** `js/features/<area>/index.js` exporting a `mount(root)` fn
   that wires events and registers subscriptions.
4. **Import** the new mount in `js/main.js` and call it.
5. **Delete** the equivalent block from `app.js`. Run the app; verify the
   feature still works.
6. **Run** the smoke test (Phase 6).

## Done definition

The migration is done when `app.js` is empty (or just contains the
`<script type="module">` entry) and every feature is a folder under
`js/features/`. `index.html` then loads only the GIS / Chart.js CDN
scripts plus `js/main.js`.

## Why this order

- **Foundation first** lets every later phase import the same store,
  formatters, and constants. No piece is rewritten twice.
- **Expenses first** because every other feature reads from the expense
  list (charts, filters, stats, budget). Once expenses live in the store,
  the rest is just subscriptions.
- **CSS split last** because file moves don't change behavior; doing them
  before the JS split risks merge pain.
