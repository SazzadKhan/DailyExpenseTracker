# PLAN-FALSE-ALARM — kill spurious sync-conflict dialogs; make the resolver testable

**Leverage rank: 2 of 5. Do after PLAN-LOST-LUGGAGE (same file).**

## Goal

The conflict detector in `resolveConflictQueue()`
([js/features/sync/index.js](../js/features/sync/index.js)) compares records
with `JSON.stringify({ ...expense, timestamp: '' })`. This is **key-order
sensitive**, and the two sides are *always* built in different key orders:

- Local expenses come from `validateExpense()`
  ([js/features/expenses/expenses.model.js](../js/features/expenses/expenses.model.js))
  with key order `id, type, date, category, subcategory, amount,
  description, currency, timestamp`.
- Remote expenses come from `_rowToExpense()`
  ([js/services/sheets-api.js](../js/services/sheets-api.js)) in
  `EXPENSE_HEADERS` order: `id, date, category, subcategory, amount,
  description, currency, timestamp, type`.

So two **identical** records stringify differently, and every queued
add/update whose row already reached the sheet raises a "Sync Conflict"
dialog for nothing. There are also type mismatches (`id` number vs string,
legacy rows with empty `type`) that produce the same false positives.

Fix: extract the resolver into a pure module with a canonical field-by-field
comparison, inject the confirm dialog, and cover it with smoke tests. This
is the riskiest logic in the app and currently has **zero** automated tests.

## Files to touch (exactly these)

- `js/features/sync/sync.model.js` — **new file**: pure resolver + comparator.
- `js/features/sync/index.js` — delete the inline resolver, import the pure one.
- `tests/smoke.html` — new test section.

## Implementation order

### Step 1 — create `js/features/sync/sync.model.js`

Pure module: no DOM, no `window`, no imports from services. Contents:

```js
// js/features/sync/sync.model.js
// Pure conflict-resolution logic for the offline sync queue. NO DOM.
// The interactive dialog is injected as `confirmFn` so tests can stub it.

/** @typedef {import('../../core/schema.js').Expense} Expense */

const COMPARE_FIELDS = ['date', 'category', 'subcategory', 'amount', 'description', 'currency'];

/** Effective type for comparison: legacy sheet rows have type '' — infer it. */
function effectiveType(e) {
    if (e.type === 'income' || e.type === 'expense') return e.type;
    return e.category === 'Income' ? 'income' : 'expense';
}

/**
 * Field-by-field equality, immune to key order and string/number drift.
 * Excludes `timestamp` (server-assigned) and compares id via String().
 * @param {Expense} a  @param {Expense} b
 */
export function sameExpense(a, b) {
    if (!a || !b) return a === b;
    if (String(a.id) !== String(b.id)) return false;
    if (effectiveType(a) !== effectiveType(b)) return false;
    for (const f of COMPARE_FIELDS) {
        if (f === 'amount') {
            if (Number(a.amount) !== Number(b.amount)) return false;
        } else {
            const va = String(a[f] ?? '').trim();
            const vb = String(b[f] ?? '').trim();
            if (va !== vb) return false;
        }
    }
    return true;
}
```

Then move `resolveConflictQueue` from `index.js` into this file **verbatim**
except for these five changes:

1. Signature becomes
   `export async function resolveConflictQueue(remoteExpenses, queue, lastSync, confirmFn)`
   where `confirmFn(opts)` has the same contract as `dialog.confirm` (async,
   resolves boolean). Every `await dialog.confirm({...})` becomes
   `await confirmFn({...})`.
2. Every `localFields !== remoteFields` JSON-stringify comparison pair is
   replaced by `!sameExpense(item.expense, remoteItem)`. Delete the
   `JSON.stringify({ ...x, timestamp: '' })` lines entirely.
3. **`delete/all` edge case:** replace `resolvedList = [];` with a filter
   that keeps entries created on other devices *after* the wipe was queued:

   ```js
   if (item.action === 'delete' && item.id === 'all') {
       const wipedAt = item.timestamp ? new Date(item.timestamp) : null;
       resolvedList = wipedAt
           ? resolvedList.filter(e => e.timestamp && new Date(e.timestamp) > wipedAt)
           : [];
       continue;
   }
   ```

4. Keep the timestamp-based `remoteChanged` checks exactly as they are
   (`lastSync && remoteModifiedTime && remoteModifiedTime > lastSync`) —
   they are correct; only the *field comparison* was broken.
5. No other logic changes. Resist cleaning up the `String(e.id) ===
   String(item.id)` map/filter callbacks — they are correct.

### Step 2 — rewire `js/features/sync/index.js`

1. Delete the local `resolveConflictQueue` function.
2. `import { resolveConflictQueue } from './sync.model.js';`
3. At the call site, pass the dialog through:
   `await resolveConflictQueue(remoteExpenses, queue, lastSyncTime, (opts) => dialog.confirm(opts));`
4. Keep the existing `import { dialog } ...` — it is still used here.

### Step 3 — add smoke tests in `tests/smoke.html`

Add a `// ---- sync.model ----` section following the existing `t()` /
`assertEq()` style. Import:

```js
import { sameExpense, resolveConflictQueue } from '../js/features/sync/sync.model.js';
```

Async note: the existing harness runs `fn()` synchronously. For these tests
either make `t` handle promises or (simpler, less invasive) wrap the whole
sync section in an async IIFE that pushes into `results` **before** the
render block runs — easiest correct approach: convert the render block into
a `renderResults()` function and call it from `(async () => { ...sync
tests... renderResults(); })()`, replacing the current top-level render.
The existing sync-free tests remain synchronous and unaffected.

Minimum test list (stub `confirmFn` with `async () => true` / `false` and a
call counter):

1. `sameExpense`: identical record built in *different key orders* → `true`.
2. `sameExpense`: id `123` (number) vs `'123'` (string), amount `12.5` vs
   `'12.5'` → `true`. Different amount → `false`.
3. `sameExpense`: local `type:'expense'` vs remote `type:''` (legacy row),
   same category → `true`.
4. Queued **add**, identical record already in remote → **no confirm call**,
   no duplicate in result (length unchanged).
5. Queued **add**, same id but different amount → confirm called once;
   `true` keeps local version, `false` keeps remote.
6. Queued **update**, remote untouched since `lastSync` → auto-applies
   local, **no confirm call**.
7. Queued **update**, remote `timestamp` newer than `lastSync` → confirm
   called; both answers produce the right winner.
8. Queued **update** whose id is missing remotely (deleted in cloud) →
   confirm called; `true` restores, `false` stays deleted.
9. Queued **delete**, remote edited after `lastSync` → confirm called;
   `false` ("Keep Delete") removes it, `true` keeps cloud version.
10. Queued `delete/all` with timestamp T → remote entries with
    `timestamp > T` survive, older ones are wiped.

## Edge cases a weaker model would miss

- **Key order is the bug, not `timestamp`.** The old code *looks* like it
  neutralizes timestamp differences; the spread `{ ...e, timestamp: '' }`
  preserves each object's own key insertion order, so stringify never
  matches across the two construction paths. Any fix that keeps
  `JSON.stringify` on whole objects (e.g. "sort the keys") still breaks on
  `id: 123` vs `id: '123'` — do the field-by-field compare.
- **Sheets returns strings.** `values.get` returns formatted strings for
  every cell; only `amount` is `parseFloat`ed in `_rowToExpense`. `id` is a
  string remotely but was historically `Date.now()` (number) locally.
- **Short rows.** A sheet row whose trailing cells are empty comes back
  short; `_rowToExpense` fills `''`. Local `description: ''` must compare
  equal to that — the `String(x ?? '').trim()` handles it; don't use
  strict `===` on raw values.
- **`type` was appended to the schema late** (last column). Old rows have
  `type: ''`. Comparing raw `type` would flag every legacy row; that's why
  `effectiveType()` mirrors `isIncome()` from
  `expenses.model.js:14` (`type === 'income' || category === 'Income'`).
- **Do not import `dialog` into `sync.model.js`** — that would drag DOM
  code into the test path and defeat the purpose. The injection is the
  point.
- **The async harness change:** if you `await` inside `t()` without
  restructuring, the render block executes before results arrive and the
  page shows 0 sync tests forever. Follow the `renderResults()` approach in
  Step 3.
- **`lastSync == null`** (first-ever sync): `remoteChanged` is falsy →
  local edits auto-win. That is existing intended behavior; keep it and
  cover it implicitly in test 6 by passing `null`.

## Acceptance criteria

1. Open `tests/smoke.html` → all tests green, including ≥10 new
   `sync.model` tests; total count strictly greater than before (38 → 48+).
2. `js/features/sync/sync.model.js` contains no `import` from
   `js/services/*`, no `window`, no `document`, no `dialog`.
3. `grep -n "JSON.stringify" js/features/sync/` → no matches used for
   record comparison (queue persistence in `actions.js` is fine — that file
   is untouched).
4. Manual two-browser check (matrix row 4 setup): sign in on browser A, go
   offline, add an expense; the same expense synced from browser B; back
   online, pull → **no conflict dialog**, exactly one copy of the row in
   the sheet and the list.
5. Manual real-conflict check: edit the same entry to different amounts on
   A (offline) and B (online); A back online, pull → exactly one dialog;
   both "Keep Local" and "Use Cloud" produce the chosen version locally
   **and** in the sheet after write-back.
6. Run `/synccheck` before committing.
