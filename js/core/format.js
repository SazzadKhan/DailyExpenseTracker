// js/core/format.js
// Currency, date, and number formatting. THESE FUNCTIONS FIX A REAL BUG —
// see docs/TIMEZONE_BUG.md before changing them.

import { CURRENCIES } from './constants.js';

/**
 * Extract the local calendar date as `YYYY-MM-DD`. Does NOT use UTC.
 * @param {Date | string | number} input
 * @returns {string}
 */
export function getLocalDateString(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Normalize a date string that may have come from a cloud sheet
 * (e.g. `2026-05-07T18:00:00.000Z`) into a local `YYYY-MM-DD`.
 * Plain `YYYY-MM-DD` is returned unchanged.
 * @param {string} dateStr
 * @returns {string}
 */
export function normalizeDateString(dateStr) {
    if (!dateStr) return '';
    // Already in plain YYYY-MM-DD form? Trust it (avoids UTC reinterpretation).
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    return getLocalDateString(dateStr);
}

/**
 * Format an amount using the given currency code. Falls back to USD.
 * @param {number} amount
 * @param {string} [currencyCode]
 * @returns {string}
 */
export function formatCurrency(amount, currencyCode = 'USD') {
    const cfg = CURRENCIES[currencyCode] || CURRENCIES.USD;
    try {
        return new Intl.NumberFormat(cfg.locale, {
            style: 'currency',
            currency: cfg.code,
            maximumFractionDigits: 2
        }).format(amount);
    } catch {
        return `${cfg.symbol}${Number(amount).toFixed(2)}`;
    }
}

/**
 * Human-friendly date label for tables and lists.
 * @param {string} dateStr  Local YYYY-MM-DD.
 * @returns {string}
 */
export function formatDate(dateStr) {
    if (!dateStr) return '';
    // Parse parts manually to avoid UTC shift.
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

/**
 * Debounce a function.
 * @template {(...a:any[]) => any} F
 * @param {F} fn
 * @param {number} ms
 * @returns {(...args: Parameters<F>) => void}
 */
export function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}
