// js/features/filters/filters.model.js
// Pure filter logic. Operates on (expenses, filterState) and returns a
// filtered list. NO DOM. NO globals.

/** @typedef {import('../../core/schema.js').Expense}     Expense */
/** @typedef {import('../../core/schema.js').FilterState} FilterState */

/**
 * @param {Expense[]} list
 * @param {FilterState} f
 * @returns {Expense[]}
 */
export function applyFilters(list, f) {
    const dateFrom = f.dateFrom || '';
    const dateTo   = f.dateTo   || '';
    const category = f.category || '';
    const search   = (f.search || '').toLowerCase();

    return list.filter(e => {
        if (dateFrom && (e.date || '') < dateFrom) return false;
        if (dateTo   && (e.date || '') > dateTo)   return false;
        if (category && e.category !== category)   return false;
        if (search) {
            const inDesc = (e.description || '').toLowerCase().includes(search);
            const inCat  = (e.category    || '').toLowerCase().includes(search);
            const inSub  = (e.subcategory || '').toLowerCase().includes(search);
            if (!inDesc && !inCat && !inSub) return false;
        }
        return true;
    });
}

/** @returns {FilterState} */
export const emptyFilters = () => ({ dateFrom: '', dateTo: '', category: '', search: '' });
