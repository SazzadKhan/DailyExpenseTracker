// js/features/expenses/actions.js
// Expense CRUD orchestration: validate → store update → local persist →
// cloud sync (best-effort). Each action returns the NEW list so legacy
// app.js can keep its `expenses` global in sync until the UI is migrated.
//
// Cloud sync: uses the sanctioned `window.storage` global (see AGENTS.md).
// Failures are swallowed and logged — the local truth has already been
// written, and the existing cloud layer handles its own retry/queue.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { saveExpenses } from '../../services/local-store.js';
import { log } from '../../core/log.js';
import {
    validateExpense,
    addExpense   as modelAdd,
    updateExpense as modelUpdate,
    deleteExpense as modelDelete,
    deleteAll    as modelDeleteAll
} from './expenses.model.js';

/** @typedef {import('../../core/schema.js').Expense} Expense */

const $log = log('expenses/actions');

function commit(nextList, cloudOp) {
    store.update({ expenses: nextList }, EVENTS.EXPENSES_CHANGED);
    saveExpenses(nextList);
    try { if (typeof cloudOp === 'function') cloudOp(); }
    catch (err) { $log.warn('cloud sync failed (local already saved)', err); }
    return nextList;
}

/**
 * Validate raw form input, append the expense, persist, and sync.
 * @param {Partial<Expense> & {amount:number|string}} input
 * @param {{ isIncomeCategory?: (name:string)=>boolean }} [opts]
 * @returns {{ ok:true, expense:Expense, list:Expense[] } | { ok:false, error:string }}
 */
export function add(input, opts = {}) {
    const s = store.getState();
    const v = validateExpense(input, {
        defaultCurrency: s.settings?.currency,
        isIncomeCategory: opts.isIncomeCategory
    });
    if (!v.ok) return v;

    const list = modelAdd(s.expenses, v.expense);
    commit(list, () => window.storage?.addExpense?.(v.expense));
    return { ok: true, expense: v.expense, list };
}

/**
 * Validate, replace an existing expense by id, persist, and sync.
 * @param {Partial<Expense> & {amount:number|string}} input
 * @param {{ isIncomeCategory?: (name:string)=>boolean }} [opts]
 * @returns {{ ok:true, expense:Expense, list:Expense[] } | { ok:false, error:string }}
 */
export function update(input, opts = {}) {
    const s = store.getState();
    const v = validateExpense(input, {
        defaultCurrency: s.settings?.currency,
        isIncomeCategory: opts.isIncomeCategory
    });
    if (!v.ok) return v;

    const list = modelUpdate(s.expenses, v.expense);
    commit(list, () => window.storage?.updateExpense?.(v.expense));
    return { ok: true, expense: v.expense, list };
}

/**
 * Remove an expense by id.
 * @param {string|number} id
 * @returns {Expense[]} new list
 */
export function remove(id) {
    const s = store.getState();
    const list = modelDelete(s.expenses, id);
    commit(list, () => window.storage?.deleteExpense?.(String(id)));
    return list;
}

/**
 * Wipe all expenses. Used by "Delete all" in settings.
 * @returns {Expense[]} empty list
 */
export function removeAll() {
    const list = modelDeleteAll();
    commit(list, () => window.storage?.deleteAll?.());
    return list;
}

/**
 * Replace the entire list. Used after CSV import or cloud pull.
 * Skips validation — the caller is responsible for it.
 * @param {Expense[]} list
 * @returns {Expense[]}
 */
export function setAll(list) {
    return commit(Array.isArray(list) ? list : [], null);
}
