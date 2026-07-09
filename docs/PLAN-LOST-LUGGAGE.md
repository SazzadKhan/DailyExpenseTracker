# PLAN-LOST-LUGGAGE — stop the offline sync queue from losing user data

**Leverage rank: 1 of 5. Do this first.**

## Goal

Fix three confirmed data-loss paths in the offline sync queue (shipped in
commit `387c154`). No new features, no refactors beyond what the fixes need.

The bugs, in order of severity:

1. **Queue cleared before the cloud write-back succeeds.**
   In [js/features/sync/index.js](../js/features/sync/index.js), inside
   `pullFromCloud()`: `saveQueue([])` runs at line ~209, but the merged list
   is only written to the cloud at line ~245 (`await
   storage.replaceAllExpenses(finalExpenses)`). If that write-back throws
   (offline again, token expired, API 5xx), control jumps to the `catch`
   block — the queue is already gone and the cloud never got the offline
   changes. On the **next** auto-pull (every 5 min), the queue is empty, so
   `finalExpenses = remoteExpenses` and the stale cloud list **overwrites
   the local merged list**. The user's offline entries silently vanish.

2. **`replaceAllExpenses` empties the sheet before re-filling it.**
   In [js/services/sheets-api.js](../js/services/sheets-api.js) (~line 267):
   it calls `deleteAllExpenses()` (a `:clear` request) and then `:append`s
   the new rows. If the append fails after the clear succeeds, the cloud
   sheet is **empty**. Any other device that pulls before recovery sees zero
   expenses and persists that locally.

3. **Sync code bypasses the sanctioned localStorage layer.**
   `pullFromCloud()` calls `localStorage.setItem('expenses', ...)`,
   `localStorage.setItem('settings', ...)`, `localStorage.setItem('categories', ...)`
   with hardcoded string keys (lines ~214, ~222, ~237), and
   `wipeLocalData()` in [js/features/auth/index.js](../js/features/auth/index.js)
   (lines ~57–59) does the same. Today the literals happen to match
   `STORAGE_KEYS`, but any future key rename/migration (which
   `core/schema.js` exists for) will silently split the data into two keys.

## Files to touch (exactly these)

- `js/features/sync/index.js` — fix #1, fix #3, small guard additions.
- `js/services/sheets-api.js` — fix #2 (`replaceAllExpenses` only).
- `js/features/auth/index.js` — fix #3 in `wipeLocalData()` only.

Do **not** touch `js/features/expenses/actions.js`, `js/services/storage.js`,
`core/constants.js`, or the sheet column order (do-not-touch list in
AGENTS.md).

## Implementation order

### Step 1 — reorder queue clearing in `pullFromCloud()`

In `js/features/sync/index.js`:

1. Delete the `saveQueue([]); // Clear queue after successful resolution`
   line that currently runs right after `resolveConflictQueue(...)`.
2. Move the cloud write-back **up** so it happens immediately after local
   persistence of `finalExpenses`, and clear the queue **only after it
   resolves**:

```js
if (queue.length > 0) {
    $log.info(`Sync queue has ${queue.length} items; starting conflict resolution`);
    finalExpenses = await resolveConflictQueue(remoteExpenses, queue, lastSyncTime);
    wroteBackToCloud = true;
}

// Save the merged list locally (Step 3 changes how)
...

if (wroteBackToCloud) {
    await storage.replaceAllExpenses(finalExpenses);
    saveQueue([]);   // ← only now is it safe to drop the queue
    showToast('Offline sync resolved successfully!');
}
```

Notes for the implementer:

- `storage.replaceAllExpenses` (the `_wrap` helper in
  `js/services/storage.js`) logs errors itself but **still returns a
  rejected promise** — `await` will correctly throw into the existing
  `catch`, which sets the `error` pill. That is the desired behavior; do
  not add another try/catch around it.
- Do NOT clear the queue in the `catch` block or in `finally`.
- Leave `setLastSyncTime(new Date())` where it is (end of the `try`) — on
  failure it must NOT advance, otherwise the timestamp-based conflict
  checks in `resolveConflictQueue` mis-classify remote edits on the retry.

### Step 2 — make `replaceAllExpenses` write-then-trim instead of clear-then-append

In `js/services/sheets-api.js`, rewrite `replaceAllExpenses(expenses)`:

1. If `expenses` is empty/null: keep current behavior (`deleteAllExpenses()`
   only) and return.
2. Otherwise, **first** overwrite rows starting at A2 with a `PUT`
   (`values.update`), **then** clear only the leftover tail rows:

```js
async replaceAllExpenses(expenses) {
    if (!this._spreadsheetId) return;
    if (!expenses || expenses.length === 0) return this.deleteAllExpenses();
    const values = expenses.map(_expenseToRow);
    const writeRange = encodeURIComponent(`${SHEET_NAME_EXPENSES}!A2:I${values.length + 1}`);
    await _fetchJson(
        `${SHEETS_API}/${this._spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
        { method: 'PUT', body: JSON.stringify({ values }) }
    );
    // Trim any leftover rows from a previously longer list.
    const tailRange = encodeURIComponent(`${SHEET_NAME_EXPENSES}!A${values.length + 2}:I`);
    await _fetchJson(
        `${SHEETS_API}/${this._spreadsheetId}/values/${tailRange}:clear`,
        { method: 'POST', body: '{}' }
    );
}
```

Why this shape: if the tail-clear fails, the worst case is *stale extra
rows* (recoverable, visible), never an empty sheet. Row math: data starts
at row 2, so N expenses occupy rows 2..N+1 and the tail starts at N+2.

### Step 3 — route local persistence through `local-store.js`

In `js/features/sync/index.js`:

1. Add `import { saveExpenses, saveSettings as persistSettings, saveCategories as persistCategories } from '../../services/local-store.js';`
   (aliases needed — `storage.saveSettings` / `storage.saveCategories`
   already exist in this file's scope and mean *cloud* writes; do not
   shadow or confuse them).
2. Replace `localStorage.setItem('expenses', JSON.stringify(finalExpenses))`
   with `saveExpenses(finalExpenses)`.
3. Replace `localStorage.setItem('settings', JSON.stringify(settings))`
   with `persistSettings(settings)`.
4. Replace `localStorage.setItem('categories', JSON.stringify(categories))`
   with `persistCategories(categories)`.

In `js/features/auth/index.js`, inside `wipeLocalData()`:

5. Replace the three raw `localStorage.setItem(...)` calls with
   `saveExpenses([])`, `persistCategories(freshCategories)`,
   `persistSettings(freshSettings)` (same import; keep the
   `keepSettings` condition on the settings write).

### Step 4 — guard concurrent syncs

In `js/features/sync/index.js`:

1. `pushAllToCloud()` currently ignores `isSyncing`. Add the same guard and
   flag handling `pullFromCloud()` has (`if (!storage.isCloud() || isSyncing) return;`
   … `finally { isSyncing = false; }`). Without this, the 5-minute
   auto-pull can interleave with a manual "Push to sheet" from the profile
   page and the write-then-trim in Step 2 can interleave with a pull's
   `listExpenses`.

## Edge cases a weaker model would miss

- **The rejected-but-logged promise:** `storage._wrap` attaches a
  `.catch` for logging but returns the original rejected promise. Awaiting
  it still throws. Don't "fix" the unhandled-rejection warning by
  swallowing errors — the throw is what protects the queue.
- **Queue replay after a failed write-back re-prompts the user.** After
  Step 1, a failed write-back keeps the queue; the next pull re-runs
  conflict resolution and may show the same dialogs again. That is
  acceptable and safe. Do not "improve" it by persisting dialog answers.
- **`resolveConflictQueue` can wipe everything via `delete/all`.** The
  `item.id === 'all'` branch resets `resolvedList = []`. That is existing,
  intended behavior for "Delete all" — leave it alone in this plan
  (PLAN-FALSE-ALARM handles its edge case).
- **Do not rename the `'expenses'`/`'settings'`/`'categories'` keys** while
  doing Step 3 — `STORAGE_KEYS` maps to those exact strings and existing
  users' data lives under them (do-not-touch list).
- **`saveQueue([])` fires a store event** (`SYNC_QUEUE_CHANGED`). Moving it
  later means the event fires later; nothing currently subscribes in a way
  that breaks, but do not remove the store update.
- **Sheets `values.update` needs an explicit bounded range** (`A2:I{N+1}`)
  — an open range `A2:I` with fewer rows than existing data would leave old
  rows behind *without* the tail-clear; keep both steps.

## Acceptance criteria

1. **Failed write-back preserves the queue.** With the dev server running
   (`npx --yes http-server . -p 8000 -c-1`), sign in, DevTools → Network →
   Offline, add 2 expenses (check `localStorage.syncQueue` has 2 items),
   go back online but use DevTools request blocking to block
   `sheets.googleapis.com/*:clear` and `*values*` PUTs, trigger a pull
   (profile → "Pull from sheet"). Expected: sync pill shows "Sync failed",
   `localStorage.syncQueue` **still has the 2 items**, the 2 expenses are
   still in the local list. Remove the block, pull again: queue drains to
   `[]`, the Google Sheet contains both rows.
2. **Sheet is never observed empty mid-replace.** Code-level check:
   `replaceAllExpenses` contains no call to `deleteAllExpenses()` on the
   non-empty path; the PUT precedes the `:clear`.
3. **No raw app-data keys outside local-store.** `grep -rn "setItem('expenses'\|setItem('settings'\|setItem('categories'" js/`
   returns matches only in `js/services/local-store.js` (via
   `STORAGE_KEYS`) — i.e. zero literal-key writes elsewhere.
4. **Existing smoke tests still pass:** open `tests/smoke.html` → all green.
5. Cloud-sync manual matrix rows 3, 4 and 6 in
   [CLOUD_SYNC_TEST_MATRIX.md](CLOUD_SYNC_TEST_MATRIX.md) still pass.
6. Run `/synccheck` (repo skill) before committing.
