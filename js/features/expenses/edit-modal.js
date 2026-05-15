// js/features/expenses/edit-modal.js
//
// Phase A3: owns the Edit Transaction modal (open / close / submit).
// Dispatches the update through window.__bridge.actions.updateExpense.
//
// Legacy helpers still on window: showToast, updateSubcategories,
// isIncomeCategory, updateStats, renderCharts, checkBudgetAlert.

import { $ } from '../../core/dom.js';
import { store } from '../../core/store.js';

function open(id) {
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
    /** @type {any} */ (window).updateSubcategories?.(expense.category, editSubcategory);
    editSubcategory.value = expense.subcategory;
    editAmount.value = String(expense.amount);
    editDescription.value = expense.description || '';

    modal.classList.add('active');
}

function close() {
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
    const isIncomeCategory = /** @type {any} */ (window).isIncomeCategory;
    const bridge = /** @type {any} */ (window).__bridge;
    const result = bridge?.actions?.updateExpense(input, { isIncomeCategory });
    if (!result || !result.ok) {
        /** @type {any} */ (window).showToast?.(result?.error || 'Could not save', 'warning');
        return;
    }
    /** @type {any} */ (window).__setLegacyExpenses?.(result.list);

    /** @type {any} */ (window).updateStats?.();
    /** @type {any} */ (window).renderCharts?.();
    /** @type {any} */ (window).checkBudgetAlert?.();
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

    const bridge = /** @type {any} */ (window).__bridge || ((/** @type {any} */ (window).__bridge = {}));
    bridge.openEditModal = open;
    bridge.closeEditModal = close;
}
