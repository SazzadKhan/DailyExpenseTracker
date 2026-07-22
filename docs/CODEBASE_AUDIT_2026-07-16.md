# Codebase audit — 2026-07-16

Full-project recap: feature inventory, efficiency ratings, architecture-flow
check against AGENTS.md, dead code, and a prioritized fix list. Produced from
a deep read of every `js/features/*` folder, `js/core`, `js/services`, CSS,
and `tests/`. Findings are file:line cited where possible — re-verify line
numbers before acting, since the working tree moves.

## Feature list, rated

| Feature | Rating | Why |
|---|---|---|
| Expenses CRUD (add/edit/list/CSV/delete) | Good, one bug | Clean model/UI split. `list.js` (History) builds rows with raw `innerHTML`, unescaped — see Fix #1. `expenses.ui.js` (dashboard "Recent") does the same job correctly with `escapeHtml`/`escapeAttr`. |
| Categories | Good, style nit | Solid CRUD, but bypasses the `$`/`$$` DOM helper convention — uses raw `document.getElementById`/`querySelectorAll` throughout (AGENTS.md rule 8). |
| Charts | Fair | Destroys and rebuilds all 3 Chart.js instances on *any* `EXPENSES_CHANGED`/`CATEGORIES_CHANGED`/`SETTINGS_CHANGED` event instead of `.update()` — even an unrelated theme toggle re-instantiates every chart. |
| Filters (History page) | **Dead code** | `filters/index.js` writes `store.filters` on every keystroke via `FILTERS_CHANGED`; nothing in the repo reads either (verified by grep). Real filtering is a separate, parallel implementation living directly in `list.js`. |
| Budget/alerts | Good | Small, single-purpose, correctly event-driven. |
| Settings (theme/currency/budget) | Good, minor duplication | Three files each hardcode the string literal `'settings'` instead of importing `STORAGE_KEYS.SETTINGS`. |
| Cloud Sync (Google Sheets) | Good design, fragile edges | `sync.model.js`'s conflict resolver does real field-level diffing and prompts on genuine conflicts. But: no retry/backoff anywhere in `sheets-api.js`; `pushAllToCloud()` wholesale-overwrites the remote sheet with no conflict check; single-row edits/deletes do a full-column fetch + `indexOf` scan instead of a cached row index. |
| Auth (`auth/index.js`, 443 lines) | Needs work | Mixes 4 unrelated concerns (OAuth bookkeeping, landing-page gating, cloud-activation/migration/wipe, all profile-page DOM rendering) with no internal module boundaries. `wipeLocalData`/`activateCloudBackend` have zero test coverage. |
| Navigation | Good | Small, cleanly extended: `handleNavigation` → exported `navigateTo()` so other features (Guide page) can navigate programmatically. Finished, not mid-refactor. |
| Effects (sound/haptics/confetti) | Good, one copy-paste bug | Registers **two identical `MutationObserver`s** on the same table with the same callback (`effects/index.js:275-280`) — doubles DOM-scan work per row insert. Also a `document.body` observer with `subtree:true` for a one-time hook-injection job, broader than needed. |
| Assistant / XpenseBot (chat + capture box) | Good architecture, one real gap | Provider registry (`providers.js` + adapters + `engine-llm.js`) is clean; chat and capture-box genuinely share `commitEntries()`. But offline parser and LLM path have diverged on safety flags — see Fix #4. Provider adapters (`provider-openai.js`/`provider-anthropic.js`) duplicate retry/error-extraction logic almost line-for-line. |
| Guide page (new) | Good | Not redundant with `docs/PARSER_GUIDE.md` (dev-only doc, never shipped) — runs live examples through the real parser. Minor inefficiency: ~17 redundant `localStorage` reads on open. |
| Tests | Fair | `tests/run-smoke.mjs` + `smoke.html` is a real, wired-in headless suite. `tests/extreme-lines.html`, `extreme-suite.html`, `parser-before-after.html`, `extreme-cases-*.js` are exploratory demo pages, not part of the automated suite. |

## Architecture flow (as-built)

`main.js` → `loadAll()` hydrates the single store → ~20 `mount()` calls, each
feature subscribing its own render function to store events.

**Followed cleanly:** no direct state mutation outside `store.update()`; no
feature reads `window.auth/sheetsApi/storage/dialog` (only the intended
DevTools write-mirrors exist); render-via-subscription is the norm (one
harmless exception: `csv.js:175` manually calls `checkBudgetAlert()` right
after a mutation that already triggers it via subscription).

**Deviations found:** `$`/`$$` bypassed in `categories/*`, `csv.js`,
`settings/budget-form.js`, `core/toast.js`; `categories.css` lives at the
repo root instead of `css/components/`, breaking the documented file map.

## Unnecessary code/files

1. **`filters/` feature folder** — dead subsystem (verified: `store.filters`/`FILTERS_CHANGED` has no reader anywhere).
2. **`expenses/actions.js:removeAll()`** — dead, zero call sites (verified). `delete-all.js` actually uses `actions.setAll([])`.
3. **`assistant/parser.js`** exports `normalize`, `segment`, `pairSplit`, `extractDate`, `extractAmount`, `fold`, `matchCategory` — no import sites except old demo test pages.
4. **`assistant/audit-log.js:getLog()`** — dead, no callers.
5. **`tests/extreme-lines.html`, `extreme-suite.html`, `parser-before-after.html`, `extreme-cases-*.js`, `parser-v2-baseline.js`** — exploratory demo pages from earlier parser milestones, not part of `run-smoke.mjs`.
6. **`categories.css`** at repo root — real, used CSS, just misplaced per the file map in AGENTS.md.

## Fix list — priority order

### 🔴 Critical (security / data loss)

- [ ] **1. Stored-XSS in History table** — `expense.category`/`subcategory`/`description` go into `innerHTML` unescaped in `js/features/expenses/list.js:82-92`, while `expenses.ui.js:100-107` already has `escapeHtml`/`escapeAttr` for the identical job. Attack path: CSV import or an edited/shared Google Sheet with a crafted description executes in the victim's browser. **Fix:** hoist `escapeHtml`/`escapeAttr` into `core/format.js` (or `core/dom.js`) and use in both files. Small diff — do first.
- [ ] **2. `pushAllToCloud()` last-write-wins overwrite** — `sheets-api.js:269-286`, called from `auth/index.js:129`, `categories/actions.js:30`, `csv.js:171`. Wholesale-replaces the remote sheet with zero conflict check; can silently destroy another device's changes. **Fix:** pull-then-diff before push, or route through the existing conflict resolver in `sync.model.js`. Needs a design decision — scope separately.

### 🟠 High (active bug / misleading dead work)

- [ ] **3. `filters/` folder does nothing** — delete the folder + its `mount()` call in `main.js`, OR wire `list.js` to actually consume `store.filters` and delete its duplicate DOM-reading logic. Pick one.
- [ ] **4. Parser/LLM safety-flag parity gap** — `engine-llm.js`'s `sanitizeEntries` skips the currency-mismatch, future-date, and refund/transfer/loan review flags that `parser.js` applies. Tracked in `docs/PLAN-KEY-TURN.md`. **Fix:** add `kind`/`unsure`/`currency` to `ENTRY_SCHEMA`, run the same checks in `sanitizeEntries`.

### 🟡 Medium (reliability / maintainability)

- [ ] **5. Per-edit full-column scan in Sheets sync** — `sheets-api.js:202-257` fetches the entire `A2:A` column per single-row edit/delete; no retry/backoff in `_fetchJson`. **Fix:** cache a row-index map, invalidate on structural changes; add retry-with-backoff.
- [ ] **6. `auth/index.js` monolith** (443 lines, 4 concerns, no test coverage on `wipeLocalData`/`activateCloudBackend`). **Fix:** split into `landing.js`, `profile-ui.js`, `cloud-activation.js` + slim `index.js`, matching the `expenses/` pattern.
- [ ] **7. Duplicate `MutationObserver`** — `effects/index.js:275-280`, delete the duplicate registration. One-line fix.

### 🟢 Low (cleanup, no behavior risk)

- [ ] **8.** Delete dead exports: `expenses/actions.js:removeAll()`, `assistant/audit-log.js:getLog()`, `parser.js`'s `normalize/segment/pairSplit/extractDate/extractAmount/fold/matchCategory`.
- [ ] **9.** Move `categories.css` to `css/components/categories.css`, update the `<link>` in `index.html`.
- [ ] **10.** Replace raw `document.getElementById`/`querySelectorAll` with `$`/`$$` in `categories/*`, `csv.js`, `settings/budget-form.js`, `core/toast.js`.
- [ ] **11.** Factor shared retry/error-extraction logic out of `provider-openai.js`/`provider-anthropic.js`.

### ⚪ Trivial / housekeeping

- [ ] **12.** Replace the 3× duplicated `'settings'` string literal with `STORAGE_KEYS.SETTINGS` in `settings/*.js`.
- [ ] **13.** Use Chart.js `.update()` instead of destroy/recreate for unrelated settings changes.
- [ ] **14.** Guide page: load "learned" data once per render instead of ~17 redundant `localStorage` reads.
- [ ] **15.** Remove the redundant manual `checkBudgetAlert()` call in `csv.js:175` (already fires via subscription).
- [ ] **16.** Prune/archive `tests/extreme-*.html`, `parser-before-after.html`, `parser-v2-baseline.js` if their findings are already folded into `tests/smoke.html`.
