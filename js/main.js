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
import { mount as mountExpenses } from './features/expenses/index.js';
import { mount as mountSettings } from './features/settings/index.js';
import { mount as mountCategories } from './features/categories/index.js';
import { mount as mountFilters } from './features/filters/index.js';

const $log = log('main');

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
        }
    };

    mountExpenses();
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
