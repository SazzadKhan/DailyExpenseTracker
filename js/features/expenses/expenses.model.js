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
