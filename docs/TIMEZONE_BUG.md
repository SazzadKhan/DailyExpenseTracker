# The "Timezone Shift" Date Bug (The JavaScript Date Trap)

## The Problem
During development, we encountered a notorious issue where expenses logged on a specific day (e.g., May 8th) were showing up one day prior (May 7th) after syncing with the cloud or importing from CSV. 

This is a classic software engineering issue often referred to as the **"Timezone Shift Bug"** or **"Off-by-One Date Bug"**. 

In JavaScript, this happens because of how the native `Date` object parses standard ISO date strings (with dashes):
*   `new Date("2026-05-08")` is parsed strictly as **UTC midnight** (Global Standard Time).
*   If a user is located in the Western Hemisphere (e.g., USA / UTC-4), their local browser converts that UTC midnight back to their local time, resulting in **11:00 PM on May 7th**. The date effectively rolls backward by a day.
*   Similarly, when Google Sheets (running in the user's local timezone, e.g., UTC+6 in Bangladesh) exports a date, it converts `May 8, 00:00:00` into a UTC ISO string (`2026-05-07T18:00:00.000Z`).

Initially, the app attempted to fix this by blindly extracting the first 10 characters (`2026-05-07`) from the ISO string, which locked in the backward shift.

## The Solution
We implemented a robust, timezone-agnostic `normalizeDateString()` utility in `app.js` to ensure consistent date handling across all global locations.

### How it works:
1.  **Local Storage Standard**: All dates are strictly stored in local `YYYY-MM-DD` string format, bypassing JavaScript `Date` object UTC-parsing quirks during local UI rendering.
2.  **Cloud Sync Standard**: If an incoming cloud date contains a time component (e.g., `2026-05-07T18:00:00.000Z`), the utility *intentionally* allows the browser's `Date` engine to parse it. 
    *   The browser automatically calculates the offset (e.g., adding 6 hours in Bangladesh, subtracting 4 in New York) to restore the timestamp exactly back to local midnight.
3.  **Local Extraction**: We then use our custom `getLocalDateString()` utility to safely extract the `.getFullYear()`, `.getMonth()`, and `.getDate()` directly from the offset-corrected date object, guaranteeing the calendar day remains perfectly aligned with the user's local intent.

*Note kept as persistent context for future maintenance.*
