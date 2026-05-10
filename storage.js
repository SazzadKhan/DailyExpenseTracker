// ===== Storage adapter =====
// Provides a uniform API over two backends:
//   - LocalBackend: no-op (data is already saved to localStorage by the app)
//   - SheetsBackend: writes through to the user's Google Sheet
//
// The app keeps doing its own localStorage writes so offline / signed-out
// behaviour is unchanged. Only the cloud-mirroring layer is swapped.

const NULL_BACKEND = {
    name: 'local',
    async init() { return true; },
    async pullAll() { return null; },             // nothing to pull
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
        await window.sheetsApi.findOrCreateSpreadsheet();
        return true;
    },

    // Returns { expenses, settings, categories } from the user's sheet.
    async pullAll() {
        const [expenses, settings, categories] = await Promise.all([
            window.sheetsApi.listExpenses(),
            window.sheetsApi.getSettings(),
            window.sheetsApi.getCategories()
        ]);
        return { expenses, settings, categories };
    },

    async pushAll({ expenses, settings, categories }) {
        await Promise.all([
            window.sheetsApi.replaceAllExpenses(expenses || []),
            settings ? window.sheetsApi.saveSettings(settings) : Promise.resolve(),
            categories ? window.sheetsApi.saveCategories(categories) : Promise.resolve()
        ]);
    },

    addExpense(exp) { return window.sheetsApi.appendExpense(exp); },
    updateExpense(exp) { return window.sheetsApi.updateExpense(exp); },
    deleteExpense(id) { return window.sheetsApi.deleteExpense(id); },
    deleteAllExpenses() { return window.sheetsApi.deleteAllExpenses(); },
    replaceAllExpenses(list) { return window.sheetsApi.replaceAllExpenses(list); },
    saveSettings(s) { return window.sheetsApi.saveSettings(s); },
    saveCategories(c) { return window.sheetsApi.saveCategories(c); }
};

const storage = {
    backend: NULL_BACKEND,

    isCloud() { return this.backend.name === 'sheets'; },

    useLocal() { this.backend = NULL_BACKEND; },

    async useSheets() {
        await SHEETS_BACKEND.init();
        this.backend = SHEETS_BACKEND;
    },

    // Fire-and-forget wrappers — failures are logged but don't block the UI.
    // Returns a promise so callers can await if they want.
    _wrap(fnName, ...args) {
        const p = Promise.resolve().then(() => this.backend[fnName](...args));
        p.catch(err => console.error(`[storage.${fnName}]`, err));
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

window.storage = storage;
