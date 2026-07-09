# PLAN-STALE-PASS — survive OAuth token expiry without a page reload

**Leverage rank: 3 of 5.**

## Goal

Google Identity Services access tokens live ~60 minutes and GIS has **no
refresh tokens** in the browser. Today the app only acquires a token at
sign-in / page load ([js/services/auth.js](../js/services/auth.js)):

- `getAccessToken()` (auth.js:98) returns `null` once
  `_expiresAt` is within 30 s of now.
- Every Sheets call then throws `'Not signed in'` in `_fetchJson`
  ([js/services/sheets-api.js](../js/services/sheets-api.js):29).
- `silentSignIn()` exists (auth.js:185) but is called **only once at boot**
  ([js/features/auth/index.js](../js/features/auth/index.js):402).

Net effect: any session longer than ~1 hour degrades — the 5-minute
auto-pull flips the pill to "⚠️ Sync failed" forever, and every add/edit
lands in the offline queue until the user reloads. The
[MULTI_USER_PLAN.md](MULTI_USER_PLAN.md) §10 checklist item "Token expiry →
silent refresh works" was never implemented.

Fix: an `ensureToken()` method that silently re-acquires the token on
demand, used by the Sheets client, plus a 401 retry.

## Files to touch (exactly these)

- `js/services/auth.js` — add `ensureToken()`; single-flight guard for
  concurrent token requests.
- `js/services/sheets-api.js` — `_fetchJson` awaits `ensureToken()`; one
  retry on 401.

Do **not** touch the sign-in/landing flow, `storage.js`, or `sync/index.js`.

## Implementation order

### Step 1 — single-flight silent refresh in `auth.js`

The GIS token client has **one** callback slot; the current code stores the
resolver in `this._interactiveResolver`. Two overlapping
`requestAccessToken` calls would clobber each other (the first promise never
resolves). `pullAll()` fires 3 Sheets calls via `Promise.all`, so
concurrent refresh attempts WILL happen. Guard it:

1. Add `_refreshPromise: null` to the `auth` object literal.
2. Add:

```js
/**
 * Return a currently-valid access token, silently refreshing if needed.
 * Resolves to the token string, or null if silent refresh is impossible
 * (no profile, no Google session, popup would be required).
 */
async ensureToken() {
    if (this.isSignedIn()) return this._accessToken;
    if (!this._tokenClient || !this._profile) return null;
    if (!this._refreshPromise) {
        this._refreshPromise = this.silentSignIn()
            .then(ok => (ok ? this._accessToken : null))
            .finally(() => { this._refreshPromise = null; });
    }
    return this._refreshPromise;
},
```

3. In `_onTokenResponse` a successful refresh already persists the token
   and calls `this._emit()` — that re-renders the auth UI via the existing
   `auth.onChange(renderAuthUi)` subscription. No changes needed there.

### Step 2 — use it in `sheets-api.js`

Rewrite the top of `_fetchJson`:

```js
async function _fetchJson(url, opts = {}) {
    const a = window.auth;
    let token = a && (a.ensureToken ? await a.ensureToken() : a.getAccessToken());
    if (!token) throw new Error('Not signed in');
    const doFetch = (tok) => fetch(url, {
        ...opts,
        headers: {
            'Authorization': `Bearer ${tok}`,
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        }
    });
    let res = await doFetch(token);
    if (res.status === 401 && a && a.ensureToken) {
        // Token revoked server-side before our local expiry — force refresh once.
        a._accessToken = null;
        a._expiresAt = 0;
        token = await a.ensureToken();
        if (token) res = await doFetch(token);
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Sheets API ${res.status}: ${body || res.statusText}`);
    }
    return res.status === 204 ? null : res.json();
}
```

(Keeping the `window.auth` indirection is deliberate — retiring the
`window.*` reads is a separate refactor; don't mix it into this change.)

## Edge cases a weaker model would miss

- **`prompt: 'none'` can still fail.** If the user's Google session is gone
  (signed out of Google, cookies cleared, third-party-cookie settings),
  the silent request errors via `error_callback` → `silentSignIn` resolves
  `false` → `ensureToken` returns `null` → callers get the existing
  `'Not signed in'` error path, the sync layer shows the error pill, and
  writes keep queueing. That is the correct degradation — do **not**
  auto-call `signIn()` (interactive) from `ensureToken`; browsers block
  popups outside user gestures and it would spam consent windows.
- **The single-resolver clobber.** Without `_refreshPromise`, `pullAll`'s
  three parallel calls each call `requestAccessToken`; GIS replies once,
  the other resolvers leak, and their promises hang forever — the sync pill
  sticks on "Syncing…". The single-flight guard is the actual fix, not an
  optimization.
- **Don't refresh proactively on a timer.** A `setTimeout` at
  `expiresAt - 5min` fires even when the tab is idle overnight, waking up
  Google endpoints for nothing, and Chrome throttles background timers
  anyway. On-demand refresh in `_fetchJson` covers every real call path
  (user actions, the 5-min auto-pull, the `online` handler).
- **`isSignedIn()` vs `storage.isCloud()`.** After expiry `isSignedIn()`
  is false but the backend is still `'sheets'`, so `addToQueue` keeps
  queueing (good). Don't "fix" `isCloud()` to consult `isSignedIn()` — that
  would silently drop queue items while a refresh is possible.
- **`renderAuthUi` flicker:** `renderAuthUi` calls
  `updateSyncStatus('offline')` whenever `isSignedIn()` is false (auth
  feature index.js:345). Between expiry and the next refresh the pill may
  read "📴 Local only"; after a successful `ensureToken` the refresh's
  `_emit()` re-renders. Acceptable; no change needed — but do not add extra
  status writes inside `ensureToken`.
- **401 vs 403.** Quota errors and permission errors come back 403 — do
  NOT retry those with a new token (it loops). Only 401 means the token is
  bad.
- **sessionStorage is per-tab.** A second tab starts with no token but has
  the profile in localStorage; `ensureToken` makes that tab self-heal on
  its first API call even if boot-time `silentSignIn` raced. No extra code
  needed — just don't move the profile cache out of localStorage.

## Acceptance criteria

1. **Simulated expiry heals without reload:** sign in, then in DevTools
   console run `window.auth._expiresAt = Date.now()`. Add an expense.
   Expected: row appears in the Google Sheet without reloading; pill
   returns to "☁️ Synced"; `localStorage.syncQueue` stays `[]` (or drains
   on the next pull). No hung "Syncing…" state.
2. **Parallel-call safety:** with the same forced expiry, click profile →
   "Pull from sheet" (fires 3 parallel API calls). Expected: exactly one
   token request (Network tab shows one call to
   `accounts.google.com/.../token` or one GIS iframe roundtrip), pull
   completes, all data intact.
3. **Dead Google session degrades cleanly:** sign in, then revoke the app
   at <https://myaccount.google.com/permissions> (or clear google.com
   cookies), force expiry as above, add an expense. Expected: expense saved
   locally, queued in `syncQueue`, pill shows error/offline — **no dialog
   spam, no popup, no console uncaught rejection**.
4. `tests/smoke.html` still fully green (this plan adds no pure logic, so
   no new tests required).
5. Run `/synccheck` before committing.
