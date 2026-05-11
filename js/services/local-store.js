// js/services/local-store.js
// Read/write of app state to localStorage. The only place new code should
// touch localStorage for app data. (Legacy app.js still has its own writes
// during the migration.)

import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from '../core/constants.js';
import { migrate } from '../core/schema.js';
import { log } from '../core/log.js';

const $log = log('local-store');

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch (err) {
        $log.error(`read ${key}`, err);
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        $log.error(`write ${key}`, err);
    }
}

/** Read all persisted app data and run any pending schema migrations. */
export function loadAll() {
    const raw = {
        schemaVersion: Number(localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION)) || 0,
        expenses:   readJSON(STORAGE_KEYS.EXPENSES, []),
        categories: readJSON(STORAGE_KEYS.CATEGORIES, null) || structuredClone(DEFAULT_CATEGORIES),
        settings:   { ...DEFAULT_SETTINGS, ...(readJSON(STORAGE_KEYS.SETTINGS, {}) || {}) }
    };

    // Backfill: Income category must always exist.
    if (!raw.categories.Income) {
        raw.categories.Income = structuredClone(DEFAULT_CATEGORIES.Income);
    }

    const migrated = migrate(raw);
    if (migrated.schemaVersion !== raw.schemaVersion) {
        localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, String(migrated.schemaVersion));
    }
    return migrated;
}

export const saveExpenses   = (list) => writeJSON(STORAGE_KEYS.EXPENSES, list);
export const saveCategories = (cats) => writeJSON(STORAGE_KEYS.CATEGORIES, cats);
export const saveSettings   = (s)    => writeJSON(STORAGE_KEYS.SETTINGS, s);

export function clearAll() {
    [STORAGE_KEYS.EXPENSES, STORAGE_KEYS.CATEGORIES, STORAGE_KEYS.SETTINGS]
        .forEach(k => localStorage.removeItem(k));
}
