// js/services/sheets-api.js
// Google Sheets API client.
// Wraps fetch calls to Sheets v4 + Drive v3 to read/write the user's expense
// spreadsheet. Uses the access token from services/auth.js.
//
// Schema:
//   Sheet "Expenses": header row [id, date, category, subcategory, amount,
//                                 description, currency, timestamp, type]
//   Sheet "Meta":     A=key, B=value(JSON). Rows: settings, categories.
//
// Also mirrored on `window.sheetsApi` for DevTools debugging only.

import { auth } from './auth.js';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

const EXPENSE_HEADERS = [
    'id', 'date', 'category', 'subcategory', 'amount',
    'description', 'currency', 'timestamp', 'type'
];

const SHEET_NAME_EXPENSES = 'Expenses';
const SHEET_NAME_META = 'Meta';

function _sheetIdKey(email) {
    return `expenseSheetId:${email || 'anon'}`;
}

async function _fetchJson(url, opts = {}) {
    const token = auth.getAccessToken();
    if (!token) throw new Error('Not signed in');
    const res = await fetch(url, {
        ...opts,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        }
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Sheets API ${res.status}: ${body || res.statusText}`);
    }
    return res.status === 204 ? null : res.json();
}

function _expenseToRow(exp) {
    return [
        exp.id ?? '',
        exp.date ?? '',
        exp.category ?? '',
        exp.subcategory ?? '',
        exp.amount ?? '',
        exp.description ?? '',
        exp.currency ?? '',
        exp.timestamp ?? new Date().toISOString(),
        exp.type ?? ''
    ];
}

function _rowToExpense(row) {
    if (!row) return null;
    const obj = {};
    EXPENSE_HEADERS.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
    if (obj.amount !== '' && obj.amount !== null) obj.amount = parseFloat(obj.amount);
    return obj;
}

const sheetsApi = {
    _spreadsheetId: null,

    getSpreadsheetId() {
        return this._spreadsheetId;
    },

    getSpreadsheetUrl() {
        return this._spreadsheetId
            ? `https://docs.google.com/spreadsheets/d/${this._spreadsheetId}/edit`
            : null;
    },

    async findOrCreateSpreadsheet() {
        const profile = auth.getProfile();
        const email = profile ? profile.email : null;
        const cachedKey = _sheetIdKey(email);

        // 1. Try cached id
        const cachedId = localStorage.getItem(cachedKey);
        if (cachedId) {
            try {
                await _fetchJson(`${SHEETS_API}/${cachedId}?fields=spreadsheetId`);
                this._spreadsheetId = cachedId;
                return cachedId;
            } catch (e) {
                console.warn('[sheets] Cached spreadsheet missing, will recreate.', e.message);
                localStorage.removeItem(cachedKey);
            }
        }

        // 2. Search Drive for our app's file (drive.file scope only sees files we created)
        const name = `Daily Expense Tracker${email ? ` - ${email}` : ''}`;
        try {
            const q = encodeURIComponent(
                `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
            );
            const list = await _fetchJson(
                `${DRIVE_API}?q=${q}&spaces=drive&fields=files(id,name)&pageSize=1`
            );
            if (list.files && list.files.length > 0) {
                this._spreadsheetId = list.files[0].id;
                localStorage.setItem(cachedKey, this._spreadsheetId);
                await this._ensureSheets();
                return this._spreadsheetId;
            }
        } catch (e) {
            console.warn('[sheets] Drive search failed, creating new file.', e.message);
        }

        // 3. Create a new spreadsheet
        const created = await _fetchJson(SHEETS_API, {
            method: 'POST',
            body: JSON.stringify({
                properties: { title: name },
                sheets: [
                    { properties: { title: SHEET_NAME_EXPENSES } },
                    { properties: { title: SHEET_NAME_META } }
                ]
            })
        });
        this._spreadsheetId = created.spreadsheetId;
        localStorage.setItem(cachedKey, this._spreadsheetId);

        // Write header row
        await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${encodeURIComponent(SHEET_NAME_EXPENSES + '!A1')}?valueInputOption=RAW`,
            {
                method: 'PUT',
                body: JSON.stringify({ values: [EXPENSE_HEADERS] })
            }
        );
        return this._spreadsheetId;
    },

    // Make sure both sheets exist + header row is present.
    async _ensureSheets() {
        if (!this._spreadsheetId) return;
        const meta = await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}?fields=sheets(properties(title))`
        );
        const titles = (meta.sheets || []).map(s => s.properties.title);
        const requests = [];
        if (!titles.includes(SHEET_NAME_EXPENSES)) {
            requests.push({ addSheet: { properties: { title: SHEET_NAME_EXPENSES } } });
        }
        if (!titles.includes(SHEET_NAME_META)) {
            requests.push({ addSheet: { properties: { title: SHEET_NAME_META } } });
        }
        if (requests.length) {
            await _fetchJson(`${SHEETS_API}/${this._spreadsheetId}:batchUpdate`, {
                method: 'POST',
                body: JSON.stringify({ requests })
            });
        }
        // Ensure header row
        const head = await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${encodeURIComponent(SHEET_NAME_EXPENSES + '!1:1')}`
        );
        if (!head.values || !head.values[0] || head.values[0].length === 0) {
            await _fetchJson(
                `${SHEETS_API}/${this._spreadsheetId}/values/${encodeURIComponent(SHEET_NAME_EXPENSES + '!A1')}?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ values: [EXPENSE_HEADERS] })
                }
            );
        }
    },

    async listExpenses() {
        if (!this._spreadsheetId) return [];
        const range = encodeURIComponent(`${SHEET_NAME_EXPENSES}!A2:I`);
        const data = await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${range}`
        );
        const rows = data.values || [];
        return rows.map(_rowToExpense).filter(e => e && e.id);
    },

    async appendExpense(expense) {
        if (!this._spreadsheetId) return;
        const range = encodeURIComponent(`${SHEET_NAME_EXPENSES}!A:I`);
        await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
            {
                method: 'POST',
                body: JSON.stringify({ values: [_expenseToRow(expense)] })
            }
        );
    },

    async _findRowIndex(id) {
        if (!this._spreadsheetId) return -1;
        const range = encodeURIComponent(`${SHEET_NAME_EXPENSES}!A2:A`);
        const data = await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${range}`
        );
        const ids = (data.values || []).map(r => (r[0] !== undefined ? String(r[0]) : ''));
        const idx = ids.indexOf(String(id));
        return idx === -1 ? -1 : idx + 2; // +2 because data starts at row 2 (1-based)
    },

    async updateExpense(expense) {
        if (!this._spreadsheetId) return;
        const row = await this._findRowIndex(expense.id);
        if (row === -1) {
            // Not found — fall back to append
            return this.appendExpense(expense);
        }
        const range = encodeURIComponent(`${SHEET_NAME_EXPENSES}!A${row}:I${row}`);
        await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${range}?valueInputOption=RAW`,
            {
                method: 'PUT',
                body: JSON.stringify({ values: [_expenseToRow(expense)] })
            }
        );
    },

    async deleteExpense(id) {
        if (!this._spreadsheetId) return;
        const row = await this._findRowIndex(id);
        if (row === -1) return;

        // Need the sheetId (gid) for batchUpdate.deleteDimension
        const meta = await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}?fields=sheets(properties(sheetId,title))`
        );
        const sheet = (meta.sheets || []).find(s => s.properties.title === SHEET_NAME_EXPENSES);
        if (!sheet) return;

        await _fetchJson(`${SHEETS_API}/${this._spreadsheetId}:batchUpdate`, {
            method: 'POST',
            body: JSON.stringify({
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: 'ROWS',
                            startIndex: row - 1, // 0-based
                            endIndex: row
                        }
                    }
                }]
            })
        });
    },

    async deleteAllExpenses() {
        if (!this._spreadsheetId) return;
        // Clear everything below the header
        const range = encodeURIComponent(`${SHEET_NAME_EXPENSES}!A2:I`);
        await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${range}:clear`,
            { method: 'POST', body: '{}' }
        );
    },

    async replaceAllExpenses(expenses) {
        if (!this._spreadsheetId) return;
        if (!expenses || expenses.length === 0) return this.deleteAllExpenses();
        // Write-then-trim: overwrite rows first so a failure mid-replace can
        // never leave the sheet empty (worst case: stale tail rows remain).
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
    },

    // ===== Meta (settings + categories) =====
    async _readMeta() {
        if (!this._spreadsheetId) return {};
        const range = encodeURIComponent(`${SHEET_NAME_META}!A:B`);
        const data = await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${range}`
        );
        const out = {};
        for (const row of data.values || []) {
            const key = row[0];
            const val = row[1];
            if (!key) continue;
            try { out[key] = val ? JSON.parse(val) : null; } catch (_) { out[key] = null; }
        }
        return out;
    },

    async _writeMetaKey(key, value) {
        if (!this._spreadsheetId) return;
        // Read existing meta to find the row for this key
        const range = encodeURIComponent(`${SHEET_NAME_META}!A:B`);
        const data = await _fetchJson(
            `${SHEETS_API}/${this._spreadsheetId}/values/${range}`
        );
        const rows = data.values || [];
        let rowIdx = rows.findIndex(r => r[0] === key);
        const json = JSON.stringify(value);

        if (rowIdx === -1) {
            // append
            await _fetchJson(
                `${SHEETS_API}/${this._spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
                { method: 'POST', body: JSON.stringify({ values: [[key, json]] }) }
            );
        } else {
            const r = rowIdx + 1; // 1-based
            const writeRange = encodeURIComponent(`${SHEET_NAME_META}!A${r}:B${r}`);
            await _fetchJson(
                `${SHEETS_API}/${this._spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
                { method: 'PUT', body: JSON.stringify({ values: [[key, json]] }) }
            );
        }
    },

    async getSettings() {
        const meta = await this._readMeta();
        return meta.settings || null;
    },

    async getCategories() {
        const meta = await this._readMeta();
        return meta.categories || null;
    },

    async saveSettings(settings) {
        await this._writeMetaKey('settings', settings);
    },

    async saveCategories(categories) {
        await this._writeMetaKey('categories', categories);
    }
};

export { sheetsApi };

if (typeof window !== 'undefined') {
    /** @type {any} */ (window).sheetsApi = sheetsApi;
}
