# Google OAuth Setup Guide

This app signs each user into **their own** Google account and stores their
expense data in a Google Sheet on **their** Drive. To make that work you need a
free Google Cloud OAuth Client ID — it acts as the public identity of the app
on the consent screen. (It is **not** a secret. It is meant to be checked into
the repo and shipped to the browser.)

You only need to do this **once**, then paste the Client ID into `index.html`.

---

## 1. Create / pick a Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. In the project picker (top bar) click **New Project**.
3. Name it e.g. `Daily Expense Tracker`, leave the organization blank, click **Create**.
4. Wait a few seconds, then make sure the new project is selected.

## 2. Enable the APIs

1. In the left sidebar go to **APIs & Services → Library**.
2. Search for **Google Sheets API** → click it → **Enable**.
3. Go back to the Library, search for **Google Drive API** → **Enable**.

## 3. Configure the OAuth consent screen

> Google redesigned this page in 2024. Depending on which version your project
> shows, follow **3a (new UI)** or **3b (classic wizard)**. The end result is
> the same.

### 3a. New "Branding / Audience / Data Access" UI

1. Left sidebar → **APIs & Services → OAuth consent screen**.
   (In some projects it's under **APIs & Services → Google Auth Platform**.)
2. If you see a **Get started** button, click it. Otherwise go to **Branding**.
3. **Branding** page — fill in:
   - App name: `Daily Expense Tracker`
   - User support email: your email
   - Developer contact email: your email
   - (Logo / app domain / privacy policy can stay blank.)
   - Click **Save**.
4. Open the **Audience** page (left sidebar).
   - User type: **External** → **Create** (if not already set).
   - Scroll to **Test users** → **+ Add users** → enter your Gmail address
     (and any others you want to test with) → **Save**.
   - Leave **Publishing status** as **Testing** for now.
5. Open the **Data Access** page (left sidebar) → **Add or remove scopes** →
   tick / search for and add each of:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
   - **Update** → **Save**.

### 3b. Classic wizard (older projects)

1. **APIs & Services → OAuth consent screen**.
2. User Type: **External** → **Create**.
3. Fill in App name, support email, developer email → **Save and Continue**.
4. **Scopes** step → **Add or Remove Scopes** → add the five scopes listed in
   3a step 5 above → **Save and Continue**.
5. **Test users** step → **+ Add Users** → enter your Gmail address → **Save
   and Continue**.

> ### Can't find "Test users"?
> - Make sure the right project is selected in the top bar.
> - In the new UI, **Test users** lives on the **Audience** page, not in a
>   wizard step.
> - The section only appears when **Publishing status = Testing**. If your app
>   is already **In production**, anyone can sign in and you don't need to
>   add test users at all.
> - If you used **Internal** user type (only available with Google Workspace),
>   there are no test users — every account in your workspace can sign in.

> While the app stays in *Testing*, only listed test users can sign in (limit
> 100). To open it up to everyone, open **Audience → Publish App** later —
> Google may ask you to verify the app because of the sensitive Drive/Sheets
> scopes.

## 4. Create the OAuth Client ID

1. **APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Daily Expense Tracker Web`.
5. Under **Authorized JavaScript origins**, add every origin you'll serve the
   app from. For this project:
   - `http://127.0.0.1:8000`
   - `http://localhost:8000`
   - `https://sazzadkhan.github.io` *(GitHub Pages — origin only, no path)*
6. **Authorized redirect URIs** — leave empty. (We use the implicit token flow,
   no redirect URI is needed.)
7. Click **Create**.
8. Copy the **Client ID** that looks like
   `1234567890-abcdefghijk.apps.googleusercontent.com`.

## 5. Paste it into the app

Open [index.html](index.html) and find this line near the top:

```html
<script>window.GOOGLE_OAUTH_CLIENT_ID = 'YOUR_GOOGLE_OAUTH_CLIENT_ID';</script>
```

Replace `YOUR_GOOGLE_OAUTH_CLIENT_ID` with the Client ID you just copied. Save,
reload the app — the **Sign in with Google** button now works.

## 6. First sign-in test

1. Open the app and click **Sign in with Google**.
2. Pick your Google account, accept the requested scopes.
3. The app creates a new spreadsheet called
   `Daily Expense Tracker - <your-email>` in your Drive on the first sign-in.
4. Add a transaction — open the spreadsheet from the avatar menu (**Open my
   sheet**) and confirm the row landed in the `Expenses` tab.

---

## Troubleshooting

- **"redirect_uri_mismatch" or "origin not allowed"**: the origin you're
  loading the app from is not in the **Authorized JavaScript origins** list.
  Add it in **Credentials → your OAuth client**, save, hard-refresh.
- **Stuck on the "Google hasn't verified this app" screen**: that's expected
  while the app is in *Testing* mode. Click **Advanced → Go to … (unsafe)**.
  To remove this warning permanently, publish the app and complete Google's
  verification (only required for public deployments).
- **Sign in works but data doesn't appear in the sheet**: check the browser
  console for `Sheets API ...` errors. The most common cause is the
  **Google Sheets API** or **Google Drive API** not being enabled in step 2.
- **Why is the Client ID public?** OAuth web Client IDs are designed to live
  in the browser. Authorization is enforced by the consent screen + the
  per-user access token; nobody can impersonate your app without their own
  Google account also approving it.
