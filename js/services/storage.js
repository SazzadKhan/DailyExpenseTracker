// js/services/storage.js
// Cloud-sync backend facade. Wraps either a no-op LocalBackend (used when
// the user is signed out / using the app offline) or the SheetsBackend (when
// signed in to Google).
//
// Local app data is persisted independently via js/services/local-store.js.
// This module is only the *cloud mirror* layer.

import { log } from '../core/log.js';
import { sheetsApi } from './sheets-api.js';

const $log = log('storage');

const NULL_BACKEND = {
    name: 'local',
    async init() { return true; },
    async pullAll() { return null; },
    async pushAll() { /* no-op */ },
    async addExpense() { /* no-op */ },
    async updateExpense() { /* no-op */ },
    async deleteExpense() { /* no-op */ },
    async deleteAllExpenses() { /* no-op */ },
    async replaceAllExpenses() { /* no-op */ },
    async saveSettings() { /* no-op */ },
    async saveCategories() { /* no-op */ }
};

const SHEETS_BACKEND = {
    name: 'sheets',

    async init() {
        await sheetsApi.findOrCreateSpreadsheet();
        return true;
    },

    async pullAll() {
        const [expenses, settings, categories] = await Promise.all([
            sheetsApi.listExpenses(),
            sheetsApi.getSettings(),
            sheetsApi.getCategories()
        ]);
        return { expenses, settings, categories };
    },

    async pushAll({ expenses, settings, categories }) {
        await Promise.all([
            sheetsApi.replaceAllExpenses(expenses || []),
            settings ? sheetsApi.saveSettings(settings) : Promise.resolve(),
            categories ? sheetsApi.saveCategories(categories) : Promise.resolve()
        ]);
    },

    addExpense(exp)          { return sheetsApi.appendExpense(exp); },
    updateExpense(exp)       { return sheetsApi.updateExpense(exp); },
    deleteExpense(id)        { return sheetsApi.deleteExpense(id); },
    deleteAllExpenses()      { return sheetsApi.deleteAllExpenses(); },
    replaceAllExpenses(list) { return sheetsApi.replaceAllExpenses(list); },
    saveSettings(s)          { return sheetsApi.saveSettings(s); },
    saveCategories(c)        { return sheetsApi.saveCategories(c); }
};

export const storage = {
    backend: NULL_BACKEND,

    isCloud() { return this.backend.name === 'sheets'; },

    useLocal() { this.backend = NULL_BACKEND; },

    async useSheets() {
        await SHEETS_BACKEND.init();
        this.backend = SHEETS_BACKEND;
    },

    _wrap(fnName, ...args) {
        const p = Promise.resolve().then(() => this.backend[fnName](...args));
        p.catch(err => $log.error(`${fnName}`, err));
        return p;
    },

    pullAll()                 { return this._wrap('pullAll'); },
    pushAll(state)            { return this._wrap('pushAll', state); },
    addExpense(exp)           { return this._wrap('addExpense', exp); },
    updateExpense(exp)        { return this._wrap('updateExpense', exp); },
    deleteExpense(id)         { return this._wrap('deleteExpense', id); },
    deleteAllExpenses()       { return this._wrap('deleteAllExpenses'); },
    replaceAllExpenses(list)  { return this._wrap('replaceAllExpenses', list); },
    saveSettings(s)           { return this._wrap('saveSettings', s); },
    saveCategories(c)         { return this._wrap('saveCategories', c); }
};

// Back-compat: legacy code (auth.js, sheets-api.js, classic scripts) still
// references window.storage. Remove once those services are migrated too.
if (typeof window !== 'undefined') {
    window.storage = storage;
}
