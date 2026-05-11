# Daily Expense Tracker — Setup Guide

The app runs as a **static site** (HTML + JS + CSS — no backend). For each
signed-in user, all data is stored in a Google Sheet on **their own** Google
Drive, accessed directly from the browser via the Google Sheets API.

## Quick start (local)

1. Clone the repo.
2. Follow [OAUTH_SETUP.md](OAUTH_SETUP.md) to create a free Google Cloud OAuth
   Client ID and paste it into `index.html`.
3. Serve the folder with any static server, e.g.:
   ```powershell
   python -m http.server 8000
   ```
4. Open <http://127.0.0.1:8000> and click **Sign in with Google**.

## Deploying to GitHub Pages

1. Push the repo to GitHub.
2. **Settings → Pages →** deploy from `main` / root.
3. Add the resulting `https://<user>.github.io` (or custom domain) to
   **Authorized JavaScript origins** of your OAuth Client (see
   [OAUTH_SETUP.md](OAUTH_SETUP.md), step 4.5).
4. Visit the deployed URL and sign in.

## How data is stored

- **Signed out**: everything stays in this browser's `localStorage`. No
  network calls.
- **Signed in**: on first sign-in the app creates a spreadsheet called
  `Daily Expense Tracker - <your-email>` in your Drive (using the
  `drive.file` scope, which only lets the app see files it created itself).
  Every add / edit / delete is mirrored to that sheet. Open it any time from
  the avatar menu **→ Open my sheet**.

## Files

| File | Purpose |
| --- | --- |
| [index.html](index.html) | Markup + script tags + OAuth Client ID config |
| [app.js](app.js) | Application logic, UI, charts |
| [auth.js](auth.js) | Google Identity Services OAuth flow |
| [sheets-api.js](sheets-api.js) | Google Sheets / Drive REST wrapper |
| [storage.js](storage.js) | Adapter switching between local + cloud backends |
| [styles.css](styles.css) | Styles |
| [OAUTH_SETUP.md](OAUTH_SETUP.md) | One-time Google Cloud setup |

## Troubleshooting

- **"Sign in with Google" button is missing**: you didn't paste your Client
  ID into `index.html` yet. See [OAUTH_SETUP.md](OAUTH_SETUP.md).
- **Sign-in popup is blocked**: allow popups for the site, then click again.
- **Sync fails after a while**: tokens expire after ~1 hour. Click **Sign
  out** and back in, or just let the app re-prompt silently on next action.
