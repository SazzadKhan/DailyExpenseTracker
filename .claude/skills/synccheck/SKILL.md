---
name: synccheck
description: Verify cloud-sync / offline-queue changes against the sync safety checklist
---

Review the current sync-related changes (or the area named in: $ARGUMENTS) against this checklist. Read only `js/features/sync/`, `js/services/storage.js`, and `js/services/sheets-api.js` unless the diff touches other files.

Checklist:
1. **Column order preserved** — Sheets rows must stay `[id, date, category, subcategory, amount, description, currency, timestamp, type]`. Any reorder corrupts existing users' data.
2. **No silent overwrite** — first sign-in must prompt before migrating/pushing; cloud pull must never clobber unsynced local changes without conflict resolution.
3. **Dates** — local `YYYY-MM-DD` strings via `getLocalDateString`/`normalizeDateString`; no `new Date('YYYY-MM-DD')`.
4. **Amounts** — Numbers validated with `Number.isFinite && >= 0` at the boundary (cloud pull, CSV import), not mid-pipeline.
5. **Offline queue** — operations queued while offline must survive a reload (persisted, not in-memory only) and replay in order.
6. **STORAGE_KEYS unchanged** — renaming a localStorage key loses user data; a schema change needs `SCHEMA_VERSION` bump + migration in `core/schema.js`.

Consult `docs/CLOUD_SYNC_TEST_MATRIX.md` for the manual test scenarios and report which apply to this diff.

Output: a short pass/fail per checklist item with file:line for any failure. Do not fix anything unless asked.
