// js/main.js
// Single entry point for the app. Loaded as <script type="module">.
// Hydrates the store from localStorage and mounts every feature module.

import { store } from './core/store.js';
import { loadAll } from './services/local-store.js';
// Services are imported directly by their consumers; these side-effect
// imports only guarantee the window.* debug mirrors exist for DevTools.
import './services/auth.js';
import './services/sheets-api.js';
import './services/storage.js';
import './services/dialog.js';
import { log } from './core/log.js';
import { mount as mountExpenses } from './features/expenses/index.js';
import { mount as mountAddModal } from './features/expenses/add-modal.js';
import { mount as mountList } from './features/expenses/list.js';
import { mount as mountEditModal } from './features/expenses/edit-modal.js';
import { mount as mountCSV } from './features/expenses/csv.js';
import { mount as mountDeleteAll } from './features/expenses/delete-all.js';
import { mount as mountSettings } from './features/settings/index.js';
import { mount as mountCategories } from './features/categories/index.js';
import { mount as mountFilters } from './features/filters/index.js';
import { mount as mountCharts } from './features/charts/index.js';
import { mount as mountBudget } from './features/budget/index.js';
import { mount as mountSync } from './features/sync/index.js';
import { mount as mountAuth } from './features/auth/index.js';
import { mount as mountNavigation } from './features/navigation/index.js';
import { mount as mountEffects } from './features/effects/index.js';
import { mount as mountAssistant } from './features/assistant/index.js';
import { mount as mountCapture } from './features/capture/index.js';

const $log = log('main');

function boot() {
    // Apply flag-emoji polyfill for Windows (CDN sets the global).
    /** @type {any} */ const w = window;
    if (typeof w.countryFlagEmojiPolyfill !== 'undefined') {
        w.countryFlagEmojiPolyfill.polyfillCountryFlagEmojis();
    }

    const persisted = loadAll();
    store.hydrate({
        expenses: persisted.expenses,
        categories: persisted.categories,
        settings: persisted.settings
    });

    // Expose the store on window for DevTools debugging only.
    /** @type {any} */ (window).__store = store;

    mountExpenses();
    mountAddModal();
    mountList();
    mountEditModal();
    mountCSV();
    mountDeleteAll();
    mountSettings();
    mountCategories();
    mountFilters();
    mountCharts();
    mountBudget();
    mountSync();
    mountAuth();
    mountNavigation();
    mountEffects();
    mountAssistant();
    mountCapture();
    $log.info('booted; modular features mounted');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
