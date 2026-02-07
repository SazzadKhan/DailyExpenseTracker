/**
 * Google Apps Script for Daily Expense Tracker
 * 
 * This script acts as an API to read/write data from/to Google Sheets.
 * Deploy this as a Web App to use with your expense tracker.
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Paste this entire code
 * 4. Save and Deploy as Web App (set access to "Anyone")
 * 5. Copy the deployment URL and paste it in your app's config
 */

// Get the active spreadsheet
function getSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Expenses');

    // Create sheet if it doesn't exist
    if (!sheet) {
        sheet = ss.insertSheet('Expenses');
        // Add headers
        sheet.getRange(1, 1, 1, 8).setValues([[
            'id', 'date', 'category', 'subcategory', 'amount', 'description', 'currency', 'timestamp'
        ]]);
        sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
    }

    return sheet;
}

// Get settings sheet
function getSettingsSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Settings');

    if (!sheet) {
        sheet = ss.insertSheet('Settings');
        sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
        sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    }

    return sheet;
}

// Get categories sheet
function getCategoriesSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Categories');

    if (!sheet) {
        sheet = ss.insertSheet('Categories');
        sheet.getRange(1, 1, 1, 3).setValues([['name', 'icon', 'subcategories']]);
        sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    }

    return sheet;
}

// Handle HTTP GET requests
function doGet(e) {
    const action = e.parameter.action;
    let result;

    try {
        switch (action) {
            case 'getExpenses':
                result = getExpenses();
                break;
            case 'getSettings':
                result = getSettings();
                break;
            case 'getCategories':
                result = getCategories();
                break;
            default:
                result = { success: false, error: 'Unknown action' };
        }
    } catch (error) {
        result = { success: false, error: error.toString() };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

// Handle HTTP POST requests
function doPost(e) {
    let result;

    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        switch (action) {
            case 'addExpense':
                result = addExpense(data.expense);
                break;
            case 'updateExpense':
                result = updateExpense(data.expense);
                break;
            case 'deleteExpense':
                result = deleteExpense(data.id);
                break;
            case 'deleteAllExpenses':
                result = deleteAllExpenses();
                break;
            case 'saveSettings':
                result = saveSettings(data.settings);
                break;
            case 'saveCategories':
                result = saveCategories(data.categories);
                break;
            case 'syncAll':
                result = syncAll(data);
                break;
            default:
                result = { success: false, error: 'Unknown action' };
        }
    } catch (error) {
        result = { success: false, error: error.toString() };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

// Get all expenses
function getExpenses() {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
        return { success: true, expenses: [] };
    }

    const headers = data[0];
    const expenses = data.slice(1).map(row => {
        const expense = {};
        headers.forEach((header, index) => {
            expense[header] = row[index];
        });
        return expense;
    });

    return { success: true, expenses: expenses };
}

// Add new expense
function addExpense(expense) {
    const sheet = getSheet();
    const timestamp = new Date().toISOString();

    sheet.appendRow([
        expense.id,
        expense.date,
        expense.category,
        expense.subcategory,
        expense.amount,
        expense.description || '',
        expense.currency || 'USD',
        timestamp
    ]);

    return { success: true, expense: expense };
}

// Update existing expense
function updateExpense(expense) {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        if (data[i][0] == expense.id) {
            sheet.getRange(i + 1, 2, 1, 6).setValues([[
                expense.date,
                expense.category,
                expense.subcategory,
                expense.amount,
                expense.description || '',
                expense.currency || 'USD'
            ]]);
            return { success: true, expense: expense };
        }
    }

    return { success: false, error: 'Expense not found' };
}

// Delete expense by ID
function deleteExpense(id) {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        if (data[i][0] == id) {
            sheet.deleteRow(i + 1);
            return { success: true };
        }
    }

    return { success: false, error: 'Expense not found' };
}

// Delete all expenses
function deleteAllExpenses() {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
    }

    return { success: true };
}

// Get settings
function getSettings() {
    const sheet = getSettingsSheet();
    const data = sheet.getDataRange().getValues();

    const settings = {};
    for (let i = 1; i < data.length; i++) {
        try {
            settings[data[i][0]] = JSON.parse(data[i][1]);
        } catch (e) {
            settings[data[i][0]] = data[i][1];
        }
    }

    return { success: true, settings: settings };
}

// Save settings
function saveSettings(settings) {
    const sheet = getSettingsSheet();

    // Clear existing settings
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
    }

    // Write new settings
    Object.keys(settings).forEach(key => {
        const value = typeof settings[key] === 'object'
            ? JSON.stringify(settings[key])
            : settings[key];
        sheet.appendRow([key, value]);
    });

    return { success: true };
}

// Get categories
function getCategories() {
    const sheet = getCategoriesSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
        return { success: true, categories: null };
    }

    const categories = {};
    for (let i = 1; i < data.length; i++) {
        try {
            categories[data[i][0]] = {
                icon: data[i][1],
                subcategories: JSON.parse(data[i][2])
            };
        } catch (e) {
            // Skip invalid rows
        }
    }

    return { success: true, categories: Object.keys(categories).length > 0 ? categories : null };
}

// Save categories
function saveCategories(categories) {
    const sheet = getCategoriesSheet();

    // Clear existing categories
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
    }

    // Write new categories
    Object.keys(categories).forEach(name => {
        sheet.appendRow([
            name,
            categories[name].icon,
            JSON.stringify(categories[name].subcategories)
        ]);
    });

    return { success: true };
}

// Sync all data at once (for initial load or full sync)
function syncAll(data) {
    const results = {};

    if (data.expenses) {
        // Clear and rewrite all expenses
        const sheet = getSheet();
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
            sheet.deleteRows(2, lastRow - 1);
        }

        data.expenses.forEach(expense => {
            addExpense(expense);
        });
        results.expenses = true;
    }

    if (data.settings) {
        saveSettings(data.settings);
        results.settings = true;
    }

    if (data.categories) {
        saveCategories(data.categories);
        results.categories = true;
    }

    return { success: true, synced: results };
}
