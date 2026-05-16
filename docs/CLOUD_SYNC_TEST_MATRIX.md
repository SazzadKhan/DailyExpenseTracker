# Cloud-Sync Test Matrix (Phase E pre-mortem)

> Run this BEFORE merging Phase E (shell + auth + cloud) work. Each row
> must pass on a real Google account against the real Sheets API. There
> is no mock — the surface area is too small to be worth one, and the
> failure modes (drift, silent overwrite) only show up against the live
> backend.

## Test accounts you need

- A throw-away Google account with Drive access. Create one if needed.
- Two browsers (Chrome + Firefox, or Chrome + Chrome Incognito) so you
  can simulate "second device" without buying a phone.

## Reset procedure between scenarios

1. Open DevTools → Application → Storage → **Clear site data**.
2. In the test Google account: Drive → search "Daily Expense Tracker" →
   move the sheet to Trash → **Empty trash** (the sheet is the cloud
   state; leaving it in Trash means it can still be found).
3. Reload the app at <http://127.0.0.1:8000>.

## Matrix

| # | Scenario | Setup | Action | Expected |
|---|---|---|---|---|
| 1 | **Fresh sign-in, no remote sheet** | Reset done. No sheet in Drive. | Sign in with Google. | App creates a new sheet on Drive named after the app. Sync indicator goes idle. Empty expense list. No prompts. |
| 2 | **Fresh sign-in, remote sheet exists** | Reset local data only. A populated sheet from a previous run is in Drive. | Sign in. | App finds the existing sheet, pulls all rows into the table. No prompts. Row count matches the sheet. |
| 3 | **Returning sign-in (both sides have data)** | Local has 3 entries from guest mode. Same account has a populated sheet from a prior session. | Sign in. | Migration prompt appears asking the user to choose: keep local, keep cloud, or merge. Whichever is chosen is the only data shown afterward; the other side is NOT silently overwritten. |
| 4 | **Second device** | Scenario 2 left a sheet with N rows. | In a second browser, sign in with the same account. | Same N rows appear. Adding an entry on device A and reloading device B shows the new entry. |
| 5 | **Offline sign-in** | Reset done. DevTools → Network → Offline. | Click "Sign in with Google". | Sign-in fails gracefully with a visible error/toast; the landing page stays usable; "Continue as guest" still works. No JS errors. |
| 6 | **Sign-out** | Currently signed in with data in both local cache and cloud. | Click Sign out. | Cloud sheet is left untouched (verify in Drive). Local data either persists or is wiped according to the existing prompt — whichever it is, the behavior must match what it was before the refactor (no surprise change). |

## What to record per scenario

- ✅ / ❌
- Console errors (paste if any).
- For scenario 3: which option you picked and whether the other side was
  preserved.
- For scenario 4: time delta between writing on A and visibility on B
  (sanity check that we're not over-caching).

## When this matrix can be retired

After Phase E has shipped to production for at least one week with no
sync-related issue reports, this file can be archived. Until then, run
it before every Phase E PR merge.
