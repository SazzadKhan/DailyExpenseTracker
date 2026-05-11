# Multi-User Google Auth — Feature Plan

Branch: `multi-user-google-auth`
Goal: Let any user sign in with their Google account and store their expense data in a Google Sheet on **their own** Drive (not the developer's).

---

## Architecture options

### Option A — Per-user Google Sheet via OAuth + Sheets API *(recommended)*
- User clicks **Sign in with Google** → Google Identity Services (GIS) OAuth flow in the browser
- Obtain an access token with scopes:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive.file`
- Browser calls the Google Sheets API directly to:
  - Create a spreadsheet named `Daily Expense Tracker - <user>` in the user's Drive on first login
  - Read / append / update / delete rows (replaces all `postToCloud` / `fetchFromCloud` calls)
- **No Apps Script, no shared backend.** Each user's data lives entirely in their own Drive.
- Requires registering an OAuth Client ID in Google Cloud Console (free). Users see your app name on the consent screen.
- Works on GitHub Pages (pure static site).

### Option B — Keep the central Apps Script, add per-user sheets
- Keep your deployed Apps Script as a router
- Apps Script (running as you) creates a tab / sheet per signed-in user in **your** Drive
- Browser sends a Google ID token to identify the user
- Pro: existing Apps Script code mostly intact
- Con: all data still lives in **your** Google account — doesn't match the stated goal

### Option C — Hybrid
- Sign in with Google (ID token only, for identity)
- User pastes / owns their own Apps Script URL, or you provision one per user
- Most complex, least clean

**Decision: Option A** is the cleanest match for "log in with their Google account… create a Google sheet on their account."

---

## Open questions (to confirm before coding)

1. **Confirm Option A?** Per-user sheets via OAuth + Sheets API directly from the browser, retiring the central Apps Script for signed-in users.
2. **OAuth Client ID** — do you already have a Google Cloud project + OAuth Client ID, or should the code ship with a placeholder + a setup guide for you to create one?
3. **Offline / not-signed-in mode** — keep working with localStorage like today and offer "sync to my Google Sheet" after sign-in? Or require sign-in?
4. **Legacy fallback** — keep the existing Apps Script URL working so current data isn't lost, or clean break?

### Decisions (resolved)

1. ✅ **Option A** — per-user sheets via OAuth + Sheets API.
2. ✅ Ship a **placeholder Client ID** plus [OAUTH_SETUP.md](OAUTH_SETUP.md) with step-by-step instructions.
3. ✅ **Hybrid offline-first**: localStorage works without sign-in; on sign-in the app prompts to upload existing local data to the new Google Sheet.
4. ✅ **Clean break** — `google-apps-script.js` and `GOOGLE_SCRIPT_URL` removed.

---

## Implementation outline (Option A)

### 1. Google Cloud setup (manual, one-time)
- Create / pick a Google Cloud project
- Enable **Google Sheets API** and **Google Drive API**
- Configure OAuth consent screen (External, scopes above, test users while in testing)
- Create an **OAuth 2.0 Client ID** of type *Web application*
  - Authorized JavaScript origins: `http://127.0.0.1:8000`, `http://localhost:8000`, `https://<github-username>.github.io`
- Copy Client ID into the app config

### 2. Auth module (`auth.js` — new file)
- Load Google Identity Services script: `https://accounts.google.com/gsi/client`
- Implement:
  - `initAuth(clientId)` — initialize token client
  - `signIn()` — request access token (interactive)
  - `signOut()` — revoke + clear token
  - `getAccessToken()` — return cached token, refresh if near expiry
  - `getUserProfile()` — decode ID token (email, name, picture)
- Persist token expiry only; never long-term-store the token itself in plain localStorage if avoidable (use sessionStorage)

### 3. Sheets API client (`sheets-api.js` — new file)
Wraps `fetch` calls to `https://sheets.googleapis.com/v4/spreadsheets/...`
- `findOrCreateSpreadsheet()`
  - On first login: create spreadsheet with header row matching current schema (`id, date, category, subcategory, amount, description, currency, timestamp, type`)
  - Persist spreadsheet ID in user-scoped localStorage key (e.g. `expenseSheetId:<email>`)
  - On later logins: verify the saved ID still exists; otherwise re-create
- `listExpenses()` → GET values
- `appendExpense(expense)` → values.append
- `updateExpense(id, expense)` → batchUpdate by row index (lookup by id)
- `deleteExpense(id)` → batchUpdate clear or delete row
- Optional: also store `categories` and `settings` on a second sheet/tab so they roam across devices

### 4. UI changes (`index.html` + `styles.css`)
- Replace the `Offline mode` indicator with a sign-in / profile widget in the header:
  - Signed out: **Sign in with Google** button
  - Signed in: avatar + name dropdown → Sign out, Open my sheet
- Add a "Sign in to sync" banner on first run
- Profile page (currently a stub) shows account info + spreadsheet link

### 5. Refactor `app.js` data layer
Introduce a small storage adapter so the rest of the code is unchanged:
- `storage.load()`, `storage.addExpense()`, `storage.updateExpense()`, `storage.deleteExpense()`, `storage.replaceAll()`
- Backends:
  - `LocalStorageBackend` (current behavior, default until sign-in)
  - `GoogleSheetsBackend` (uses `sheets-api.js`, active after sign-in)
- On sign-in for the first time: prompt to **migrate localStorage data → user's new sheet**
- Replace direct `postToCloud` / `fetchFromCloud` calls with `storage.*`
- Remove (or hide behind a feature flag) the hard-coded `GOOGLE_SCRIPT_URL`

### 6. Sync UX
- Optimistic local updates, then write-through to Sheets
- Queue writes while offline / token-expired; flush on reconnect / re-auth
- Sync indicator reuses existing `updateSyncStatus` states

### 7. Security / privacy
- Use `drive.file` scope (NOT full `drive`) — app only sees files it created
- No secrets in repo; Client ID is public-by-design but document it
- CSP-safe: only `accounts.google.com` and `sheets.googleapis.com` added to allowed origins
- Sign out revokes token via `google.accounts.oauth2.revoke`

### 8. Migration / fallback
- Keep `google-apps-script.js` and old `GOOGLE_SCRIPT_URL` path under a `legacyMode` flag for a release or two
- One-shot importer: "Import data from legacy Apps Script" button in Settings → Data

### 9. Docs
- Update `SETUP_GUIDE.md` (or new `OAUTH_SETUP.md`) with Google Cloud Console steps
- Note that GitHub Pages origin must be added to OAuth client

### 10. Testing checklist
- Fresh user → sign in → spreadsheet auto-created in their Drive
- Add / edit / delete expense round-trips to the sheet
- Sign out → local data preserved (read-only) or cleared (configurable)
- Second device sign-in → reads existing sheet, no duplicates
- Token expiry → silent refresh works
- Revoked access in Google Account settings → app prompts re-auth gracefully

---

## File changes summary (planned)

| File                  | Change                                                    |
| --------------------- | --------------------------------------------------------- |
| `index.html`          | Add GIS script tag, sign-in button, profile widget        |
| `auth.js` *(new)*     | OAuth flow + token management                             |
| `sheets-api.js` *(new)* | Sheets v4 wrapper                                       |
| `storage.js` *(new)*  | Adapter pattern over local + sheets backends              |
| `app.js`              | Replace cloud calls with `storage.*`; wire sign-in events |
| `styles.css`          | Styles for sign-in button, avatar dropdown                |
| `SETUP_GUIDE.md`      | OAuth setup section                                       |
| `MULTI_USER_PLAN.md`  | This file                                                 |
