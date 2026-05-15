// js/features/expenses/expenses.model.js
// Pure functions over the expense list. NO DOM. NO globals. NO localStorage.
// Anything that needs `state.expenses` plus a calculation belongs here.

import { ENTRY_TYPES } from '../../core/constants.js';
import { getLocalDateString } from '../../core/format.js';

/** @typedef {import('../../core/schema.js').Expense} Expense */

/**
 * @param {Expense} e
 * @returns {boolean}
 */
export const isIncome = (e) =>
    e.type === ENTRY_TYPES.INCOME || e.category === 'Income';

/**
 * Sort by date desc, then by id desc — same order legacy app.js used.
 * @param {Expense[]} list
 */
export function sortByDateDesc(list) {
    return [...list].sort((a, b) => {
        const da = (a.date || '').slice(0, 10);
        const db = (b.date || '').slice(0, 10);
        if (da < db) return 1;
        if (da > db) return -1;
        return Number(b.id || 0) - Number(a.id || 0);
    });
}

/**
 * Most-recent N entries.
 * @param {Expense[]} list
 * @param {number}    [n]
 */
export const selectRecent = (list, n = 10) => sortByDateDesc(list).slice(0, n);

/**
 * Stats computed from the full expense list. Used by the header cards.
 * @param {Expense[]} list
 */
export function selectStats(list) {
    const today = getLocalDateString(new Date());
    const month = today.slice(0, 7);

    let todaySpend = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    for (const e of list) {
        const date = (e.date || '').slice(0, 10);
        const amt = Number(e.amount) || 0;
        const inc = isIncome(e);
        if (date === today && !inc) todaySpend += amt;
        if (date.startsWith(month)) {
            if (inc) monthIncome += amt;
            else     monthExpense += amt;
        }
    }

    return {
        todaySpend,
        monthIncome,
        monthExpense,
        remaining: monthIncome - monthExpense,
        totalEntries: list.length
    };
}

// ===== CRUD: pure operations over the list ================================
// Each function returns a NEW array. Never mutates the input. The orchestration
// (persist, cloud sync, store dispatch) lives in `./actions.js`.

/**
 * Validate a raw form input and produce a normalized Expense.
 * Returns `{ ok:true, expense }` on success, or `{ ok:false, error }` with a
 * user-facing message.
 *
 * @param {Partial<Expense> & {amount: number|string}} input
 * @param {{ defaultCurrency?: string, isIncomeCategory?: (name:string)=>boolean }} [opts]
 * @returns {{ ok: true, expense: Expense } | { ok: false, error: string }}
 */
export function validateExpense(input, opts = {}) {
    if (!input || typeof input !== 'object') {
        return { ok: false, error: 'No data' };
    }
    const category = String(input.category || '').trim();
    if (!category) return { ok: false, error: 'Please pick a category' };

    const subcategory = String(input.subcategory || '').trim();
    if (!subcategory) return { ok: false, error: 'Please pick a subcategory' };

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: 'Amount must be a positive number' };
    }

    const date = String(input.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { ok: false, error: 'Date must be YYYY-MM-DD' };
    }

    const isIncomeCat = typeof opts.isIncomeCategory === 'function'
        ? opts.isIncomeCategory(category)
        : (category === 'Income');
    const type = isIncomeCat ? ENTRY_TYPES.INCOME : ENTRY_TYPES.EXPENSE;

    /** @type {Expense} */
    const expense = {
        id: String(input.id || Date.now()),
        type,
        date,
        category,
        subcategory,
        amount,
        description: String(input.description || '').trim(),
        currency: String(input.currency || opts.defaultCurrency || 'USD')
    };
    return { ok: true, expense };
}

/**
 * Append an expense to the list (no mutation).
 * @param {Expense[]} list
 * @param {Expense}   exp
 * @returns {Expense[]}
 */
export function addExpense(list, exp) {
    return [...list, exp];
}

/**
 * Replace an expense by id. If not found, returns the list unchanged.
 * @param {Expense[]} list
 * @param {Expense}   exp
 * @returns {Expense[]}
 */
export function updateExpense(list, exp) {
    let found = false;
    const out = list.map(e => {
        if (String(e.id) === String(exp.id)) { found = true; return exp; }
        return e;
    });
    return found ? out : list;
}

/**
 * Remove an expense by id.
 * @param {Expense[]} list
 * @param {string|number} id
 * @returns {Expense[]}
 */
export function deleteExpense(list, id) {
    return list.filter(e => String(e.id) !== String(id));
}

/**
 * Clear the entire list.
 * @returns {Expense[]}
 */
export function deleteAll() { return []; }

/**
 * Sort by an arbitrary column. Stable; uses lexicographic compare for strings,
 * numeric for `amount`, and date-prefix compare for `date`.
 * @param {Expense[]} list
 * @param {'date'|'category'|'subcategory'|'amount'|'description'} column
 * @param {'asc'|'desc'} direction
 * @returns {Expense[]}
 */
export function sortBy(list, column, direction = 'asc') {
    const dir = direction === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => {
        let va = a[column];
        let vb = b[column];
        if (column === 'amount') {
            va = Number(va); vb = Number(vb);
        } else if (column === 'date') {
            va = (va || '').toString().slice(0, 10);
            vb = (vb || '').toString().slice(0, 10);
        } else {
            va = (va || '').toString().toLowerCase();
            vb = (vb || '').toString().toLowerCase();
        }
        if (va < vb) return -1 * dir;
        if (va > vb) return  1 * dir;
        return 0;
    });
}
