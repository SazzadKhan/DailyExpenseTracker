// js/features/expenses/edit-modal.js
//
// Owns the Edit Transaction modal (open / close / submit + the
// #edit-subcategory <select> sync when #edit-category changes).
// Dispatches the update through ./actions.js.

import { $ } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { showToast } from '../../core/toast.js';
import { update as updateExpenseAction } from './actions.js';

const INCOME_CATEGORY_KEYS = ['Income'];
function isIncomeCategory(name) {
    return INCOME_CATEGORY_KEYS.includes(name);
}

/**
 * Repopulate #edit-subcategory <select> with the subcategories of `category`.
 * @param {string} category
 * @param {HTMLSelectElement|null} sel
 */
function fillSubcategoryOptions(category, sel) {
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Subcategory</option>';
    const cats = store.getState().categories || {};
    if (category && cats[category]) {
        for (const sub of cats[category].subcategories) {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            sel.appendChild(opt);
        }
    }
}

export function open(id) {
    const expenses = store.getState().expenses || [];
    const expense = expenses.find(e => String(e.id) === String(id));
    if (!expense) return;

    const modal = $('#edit-modal');
    const editId = /** @type {HTMLInputElement|null} */ ($('#edit-id'));
    const editDate = /** @type {HTMLInputElement|null} */ ($('#edit-date'));
    const editCategory = /** @type {HTMLSelectElement|null} */ ($('#edit-category'));
    const editSubcategory = /** @type {HTMLSelectElement|null} */ ($('#edit-subcategory'));
    const editAmount = /** @type {HTMLInputElement|null} */ ($('#edit-amount'));
    const editDescription = /** @type {HTMLInputElement|null} */ ($('#edit-description'));
    if (!modal || !editId || !editDate || !editCategory || !editSubcategory || !editAmount || !editDescription) return;

    editId.value = expense.id;
    editDate.value = expense.date;
    editCategory.value = expense.category;
    fillSubcategoryOptions(expense.category, editSubcategory);
    editSubcategory.value = expense.subcategory;
    editAmount.value = String(expense.amount);
    editDescription.value = expense.description || '';

    modal.classList.add('active');
}

export function close() {
    const modal = $('#edit-modal');
    if (modal) modal.classList.remove('active');
}

async function handleSubmit(e) {
    e.preventDefault();
    const id = /** @type {HTMLInputElement|null} */ ($('#edit-id'))?.value;
    const date = /** @type {HTMLInputElement|null} */ ($('#edit-date'))?.value;
    const category = /** @type {HTMLSelectElement|null} */ ($('#edit-category'))?.value;
    const subcategory = /** @type {HTMLSelectElement|null} */ ($('#edit-subcategory'))?.value;
    const amount = parseFloat(/** @type {HTMLInputElement|null} */ ($('#edit-amount'))?.value || '');
    const description = (/** @type {HTMLInputElement|null} */ ($('#edit-description'))?.value || '').trim();
    if (!id || !date || !category || !subcategory) return;

    const settings = store.getState().settings || {};
    const input = {
        id, date, category, subcategory, amount, description,
        currency: /** @type {any} */ (settings).currency
    };
    const result = updateExpenseAction(input, { isIncomeCategory });
    if (!result || !result.ok) {
        showToast(result?.error || 'Could not save', 'warning');
        return;
    }

    close();
}

export function mount() {
    const modal = $('#edit-modal');
    const form = $('#edit-form');
    if (!modal || !form) return;

    form.addEventListener('submit', handleSubmit);
    $('#modal-close')?.addEventListener('click', close);
    $('#modal-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    // Refill #edit-subcategory whenever the user changes #edit-category.
    const editCategory = /** @type {HTMLSelectElement|null} */ ($('#edit-category'));
    const editSubcategory = /** @type {HTMLSelectElement|null} */ ($('#edit-subcategory'));
    if (editCategory) {
        editCategory.addEventListener('change', () => {
            fillSubcategoryOptions(editCategory.value, editSubcategory);
        });
    }
}
