# Daily Expense Tracker - Google Sheets Setup Guide

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it "Expense Tracker Data"
3. In the first row, add these headers:
   - A1: `id`
   - B1: `date`
   - C1: `category`
   - D1: `subcategory`
   - E1: `amount`
   - F1: `description`
   - G1: `currency`
   - H1: `timestamp`

## Step 2: Create the Google Apps Script

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing code in the editor
3. Copy the entire contents of `google-apps-script.js` and paste it there
4. Click **Save** (give it a name like "Expense Tracker API")

## Step 3: Deploy as Web App

1. In Apps Script, click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
3. Set the following:
   - **Description**: "Expense Tracker API"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone"
4. Click **Deploy**
5. **Authorize** when prompted (click through the warnings - it's your own script)
6. **Copy the Web App URL** - you'll need this!

## Step 4: Configure the App

1. Open `app.js` in a text editor
2. Find **line 6** with `GOOGLE_SCRIPT_URL`
3. Replace `YOUR_GOOGLE_SCRIPT_URL_HERE` with the URL you copied
4. Save the file

## Step 5: Deploy to GitHub Pages

1. Create a GitHub repository
2. Push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
   git push -u origin GitHub_Pages_Google_Sheets
   ```
3. Go to your repo on GitHub → **Settings → Pages**
4. Under "Source", select the `GitHub_Pages_Google_Sheets` branch
5. Click **Save**
6. Your app will be live at: `https://YOUR_USERNAME.github.io/expense-tracker/`

## 🎉 Done!

Your expense tracker now:
- ✅ Stores data in Google Sheets (cloud storage)
- ✅ Can be accessed from anywhere via GitHub Pages
- ✅ Syncs across all your devices
- ✅ Data is backed up in your Google account

## Troubleshooting

**"Authorization required" error:**
- Make sure you authorized the script in Step 3

**Data not saving:**
- Check that the Google Script URL is correct
- Make sure the script is deployed as "Anyone can access"

**CORS errors:**
- The Apps Script handles CORS - make sure you're using the correct deployment URL
