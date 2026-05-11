// js/features/charts/charts.model.js
// Pure selectors that produce chart-ready data from the expense list.
// Chart.js rendering still lives in legacy app.js for now — these
// selectors are importable so that rewrite can be incremental.

import { ENTRY_TYPES } from '../../core/constants.js';
import { getLocalDateString } from '../../core/format.js';
import { isIncome } from '../expenses/expenses.model.js';

/** @typedef {import('../../core/schema.js').Expense} Expense */

/**
 * Day-by-day expense totals for the last `days` days (oldest → newest).
 * Income entries are excluded.
 * @param {Expense[]} list
 * @param {number}    [days]
 * @returns {{ date: string, total: number }[]}
 */
export function selectDailySeries(list, days = 30) {
    const today = new Date();
    /** @type {Map<string, number>} */
    const byDay = new Map();

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        byDay.set(getLocalDateString(d), 0);
    }

    for (const e of list) {
        if (isIncome(e)) continue;
        const key = (e.date || '').slice(0, 10);
        if (byDay.has(key)) byDay.set(key, byDay.get(key) + (Number(e.amount) || 0));
    }

    return Array.from(byDay, ([date, total]) => ({ date, total }));
}

/**
 * Per-month income/expense totals, sorted by month ascending.
 * @param {Expense[]} list
 * @returns {{ month: string, income: number, expense: number }[]}
 */
export function selectMonthlyTotals(list) {
    /** @type {Map<string, {income:number, expense:number}>} */
    const m = new Map();
    for (const e of list) {
        const month = (e.date || '').slice(0, 7);
        if (!month) continue;
        if (!m.has(month)) m.set(month, { income: 0, expense: 0 });
        const slot = m.get(month);
        const amt = Number(e.amount) || 0;
        if (isIncome(e)) slot.income += amt;
        else             slot.expense += amt;
    }
    return Array.from(m, ([month, v]) => ({ month, ...v }))
                .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Expense-only totals grouped by category, optionally limited to one month.
 * @param {Expense[]} list
 * @param {string}    [month]  Optional `YYYY-MM` filter.
 * @returns {{ category: string, total: number }[]}
 */
export function selectCategoryBreakdown(list, month) {
    /** @type {Map<string, number>} */
    const m = new Map();
    for (const e of list) {
        if (isIncome(e)) continue;
        if (month && !(e.date || '').startsWith(month)) continue;
        m.set(e.category, (m.get(e.category) || 0) + (Number(e.amount) || 0));
    }
    return Array.from(m, ([category, total]) => ({ category, total }))
                .sort((a, b) => b.total - a.total);
}

export { ENTRY_TYPES };
