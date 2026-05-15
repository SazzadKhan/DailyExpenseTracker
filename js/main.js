// js/main.js
// Entry point for the new modular code. Loaded as <script type="module">
// AFTER the legacy classic scripts (app.js, etc.) so that:
//   - It can read whatever globals the legacy code already populated.
//   - The legacy code keeps owning anything not yet migrated.
//
// Responsibilities:
//   1. Hydrate the store from localStorage (single source of truth).
//   2. Expose a tiny "bridge" so legacy app.js can notify the store after
//      it mutates expenses/categories/settings.
//   3. Mount migrated feature modules.

import { store } from './core/store.js';
import { EVENTS } from './core/events.js';
import { loadAll } from './services/local-store.js';
import { log } from './core/log.js';
import {
    formatCurrency as fmtCurrency,
    formatDate as fmtDate,
    getLocalDateString as fmtLocalDate,
    normalizeDateString as fmtNormalizeDate,
    debounce as fmtDebounce
} from './core/format.js';
import * as expensesActions from './features/expenses/actions.js';
import { mount as mountExpenses } from './features/expenses/index.js';
import { mount as mountAddModal } from './features/expenses/add-modal.js';
import { mount as mountSettings } from './features/settings/index.js';
import { mount as mountCategories } from './features/categories/index.js';
import { mount as mountFilters } from './features/filters/index.js';

const $log = log('main');

// Expose canonical core helpers to the legacy classic script (`app.js`).
// `app.js` calls these via `window.__core.*` so there is exactly ONE
// implementation of each formatter. This bridge goes away once `app.js`
// is fully drained into modules.
/** @type {any} */ (window).__core = {
    formatCurrency: fmtCurrency,
    formatDate: fmtDate,
    getLocalDateString: fmtLocalDate,
    normalizeDateString: fmtNormalizeDate,
    debounce: fmtDebounce
};

function boot() {
    const persisted = loadAll();
    store.hydrate({
        expenses: persisted.expenses,
        categories: persisted.categories,
        settings: persisted.settings
    });

    // ----- Legacy bridge ---------------------------------------------------
    // Legacy app.js writes to localStorage and mutates its own globals.
    // After each save it calls these notifiers (one-line patch in app.js).
    // Once a feature is fully migrated, its bridge entry is removed.
    /** @type {any} */ (window).__store = store; // for debugging in DevTools
    /** @type {any} */ (window).__bridge = {
        notifyExpenses(list) {
            store.update({ expenses: Array.isArray(list) ? list : [] }, EVENTS.EXPENSES_CHANGED);
        },
        notifyCategories(cats) {
            store.update({ categories: cats || {} }, EVENTS.CATEGORIES_CHANGED);
        },
        notifySettings(s) {
            store.update({ settings: s || store.getState().settings }, EVENTS.SETTINGS_CHANGED);
        },
        // Phase A1: legacy `app.js` calls these to dispatch CRUD through the
        // store + persist + cloud sync in one place. Each returns the new list.
        actions: {
            addExpense:    expensesActions.add,
            updateExpense: expensesActions.update,
            removeExpense: expensesActions.remove,
            removeAllExpenses: expensesActions.removeAll,
            setAllExpenses:    expensesActions.setAll
        }
    };

    mountExpenses();
    mountAddModal();
    mountSettings();
    mountCategories();
    mountFilters();
    $log.info('booted; modular features mounted');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
