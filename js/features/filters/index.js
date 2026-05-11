// js/features/filters/index.js
// Mirrors the filter <input> values into store.filters so other modules
// (and future history-table rewrite) can consume them reactively.
//
// Legacy app.js still reads filter values directly from the DOM in
// getFilteredExpenses() — both code paths see the same source of truth
// (the inputs), so this mirror is non-breaking.

import { $, on } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { debounce } from '../../core/format.js';
import { emptyFilters } from './filters.model.js';

function readFromDom() {
    return {
        dateFrom: /** @type {HTMLInputElement|null} */ ($('#filter-date-from'))?.value || '',
        dateTo:   /** @type {HTMLInputElement|null} */ ($('#filter-date-to'))?.value   || '',
        category: /** @type {HTMLSelectElement|null}*/ ($('#filter-category'))?.value  || '',
        search:   /** @type {HTMLInputElement|null} */ ($('#filter-search'))?.value    || ''
    };
}

function push() {
    store.update({ filters: readFromDom() }, EVENTS.FILTERS_CHANGED);
}

export function mount() {
    // Initial snapshot (some inputs may already have values from autofill).
    store.update({ filters: { ...emptyFilters(), ...readFromDom() } }, EVENTS.FILTERS_CHANGED);

    const debouncedPush = debounce(push, 120);

    const dateFrom = $('#filter-date-from');
    const dateTo   = $('#filter-date-to');
    const category = $('#filter-category');
    const search   = $('#filter-search');
    const clearBtn = $('#clear-filters');

    if (dateFrom) on(dateFrom, 'change', push);
    if (dateTo)   on(dateTo,   'change', push);
    if (category) on(category, 'change', push);
    if (search)   on(search,   'input',  debouncedPush);

    // Legacy `clearFilters()` resets inputs then calls renderExpenses; we
    // also snapshot the empty state into the store on the same click.
    if (clearBtn) on(clearBtn, 'click', () => setTimeout(push, 0));
}
