// js/features/assistant/commit-entries.js
// Shared "parsed entries → saved expenses" step for both bot surfaces
// (chat panel and capture box). Owns id generation and error collection so
// the two features can't drift apart on how entries get persisted.

import { add } from '../expenses/actions.js';
import { isIncomeCategory } from '../categories/categories.model.js';

/**
 * Persist parsed entries via the expenses actions layer.
 * @param {Array<{date:string, category:string, subcategory:string,
 *                amount:number, description:string, needsReview?:boolean}>} entries
 * @param {{ currency:string|undefined }} opts
 * @returns {{ saved: Array<object>, accepted: Array<object>, okIds: string[], errors: string[] }}
 *   `saved` items are the stored expenses plus the parser's `needsReview`
 *   flag; `accepted` is the subset of the original parsed `entries` that
 *   were saved (kept for the learning layer, which needs the parser's
 *   `confidence` field rather than the stored-expense shape); `errors` are
 *   per-entry validation messages.
 */
export function commitEntries(entries, { currency }) {
    const base = Date.now();
    const saved = [];
    const accepted = [];
    const okIds = [];
    const errors = [];
    entries.forEach((e, i) => {
        const res = add({
            id: String(base + i),
            date: e.date,
            category: e.category,
            subcategory: e.subcategory,
            amount: e.amount,
            description: e.description,
            currency
        }, { isIncomeCategory });
        if (res.ok) {
            saved.push({ ...res.expense, needsReview: !!e.needsReview });
            accepted.push(e);
            okIds.push(res.expense.id);
        } else {
            errors.push(`${e.description || e.subcategory}: ${res.error}`);
        }
    });
    return { saved, accepted, okIds, errors };
}
