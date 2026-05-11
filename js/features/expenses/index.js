// js/features/expenses/index.js
// Mounts the expenses read-side: stats cards + dashboard recent list.
//
// CRUD (add/edit/delete forms, full history table, filters) still lives in
// the legacy app.js and will move here in a later phase. This module already
// owns the rendering of the views below — the bridge in main.js notifies the
// store whenever app.js mutates `expenses`/`categories`/`settings`.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { initDom, renderStats, renderRecent } from './expenses.ui.js';

export function mount() {
    initDom();

    const renderAll = (state) => {
        renderStats(state);
        renderRecent(state);
    };

    // First paint after hydration.
    renderAll(store.getState());

    // Subscribe to anything that affects these views.
    store.subscribe(EVENTS.EXPENSES_CHANGED,   renderAll);
    store.subscribe(EVENTS.CATEGORIES_CHANGED, renderAll);
    store.subscribe(EVENTS.SETTINGS_CHANGED,   renderAll);
}
