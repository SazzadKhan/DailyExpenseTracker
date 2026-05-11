// js/features/categories/dropdowns.js
// Keeps category <select> elements in sync with state.categories:
//   - #edit-category       (edit-expense modal)
//   - #filter-category     (history filter bar)
//   - #subcategory-category (settings → categories tab)
//
// The add-modal's visual category picker still lives in legacy app.js
// (buildAddCategoryPicker) — it has tightly coupled selection state.

import { $ } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { splitByType } from './categories.model.js';

/**
 * @param {HTMLSelectElement} sel
 * @param {import('../../core/schema.js').Categories} categories
 * @param {{ filter?: boolean }} opts
 */
function fill(sel, categories, { filter = false } = {}) {
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = filter
        ? '<option value="">All Categories</option>'
        : '<option value="">Select Category</option>';

    if (filter) {
        for (const [name, data] of Object.entries(categories)) {
            const o = document.createElement('option');
            o.value = name;
            o.textContent = `${data.icon} ${name}`;
            sel.appendChild(o);
        }
    } else {
        const { income, expense } = splitByType(categories);
        if (income.length) {
            const g = document.createElement('optgroup');
            g.label = '── Income ──';
            for (const [name, data] of income) {
                const o = document.createElement('option');
                o.value = name;
                o.textContent = `${data.icon} ${name}`;
                g.appendChild(o);
            }
            sel.appendChild(g);
        }
        if (expense.length) {
            const g = document.createElement('optgroup');
            g.label = '── Expenses ──';
            for (const [name, data] of expense) {
                const o = document.createElement('option');
                o.value = name;
                o.textContent = `${data.icon} ${name}`;
                g.appendChild(o);
            }
            sel.appendChild(g);
        }
    }

    // Preserve previous selection where possible.
    if (prev && Array.from(sel.options).some(o => o.value === prev)) {
        sel.value = prev;
    }
}

function paint(state) {
    const cats = state.categories || {};
    fill(/** @type {HTMLSelectElement} */ ($('#edit-category')),        cats);
    fill(/** @type {HTMLSelectElement} */ ($('#filter-category')),      cats, { filter: true });
    fill(/** @type {HTMLSelectElement} */ ($('#subcategory-category')), cats);
}

export function mountDropdowns() {
    paint(store.getState());
    store.subscribe(EVENTS.CATEGORIES_CHANGED, paint);
}
