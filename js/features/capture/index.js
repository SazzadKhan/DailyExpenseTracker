// js/features/capture/index.js
// Quick-capture box — the free-tier home-screen hero ("git commit for money").
// One input, one batch line ("breakfast 120, rickshaw 50 … got paid 20k"),
// then a receipt. NOT chat: no bubbles, no history, no personality.
//
// It is a second thin skin over the same engine the XpenseBot chat panel uses:
// the pure parser (parser.js), the expense actions (add/remove), and the audit
// log. Capture-then-amend: entries save optimistically the moment you log them;
// anything the parser is unsure about carries a ⚠ and is one tap to fix. The
// corpus ratchet (tests/smoke.html) guarantees a wrong guess is never silent —
// it always ships needsReview:true — which is what makes optimistic save safe.

import { $, $$, on, delegate, el, setVisible } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { getLocalDateString, formatDate, formatCurrency } from '../../core/format.js';
import { add, remove } from '../expenses/actions.js';
import { open as openEditModal } from '../expenses/edit-modal.js';
import { addSubcategory } from '../categories/actions.js';
import { isIncomeCategory } from '../categories/categories.model.js';
import { parse } from '../assistant/parser.js';
import { logInteraction, markOutcome, exportLog } from '../assistant/audit-log.js';
import { getLearnedLookup, recordOutcome, nextSuggestion, acceptSuggestion, dismissSuggestion } from '../assistant/learned.js';
import { mountVoice } from './voice.js';

let inputEl, submitEl, receiptEl;

export function mount() {
    inputEl = $('#capture-input');
    submitEl = $('#capture-submit');
    receiptEl = $('#capture-receipt');
    if (!inputEl || !submitEl || !receiptEl) return;

    // Debug/collection helper for the 10-user test: download what testers typed
    // vs what the parser did. DevTools-only, like window.__store — not shipped UI.
    /** @type {any} */ (window).__xpenseExportLog = () => {
        const blob = new Blob([exportLog()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `xpense-parse-log-${getLocalDateString(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    mountVoice(inputEl);

    on(submitEl, 'click', handleSubmit);
    // Enter submits; Shift+Enter is a newline (the box is a textarea).
    on(inputEl, 'keydown', ev => {
        const e = /** @type {KeyboardEvent} */ (ev);
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    });

    delegate(receiptEl, 'click', '[data-role="cap-amend"]', onAmend);
    delegate(receiptEl, 'click', '[data-role="cap-undo"]', onUndo);
    delegate(receiptEl, 'click', '[data-role="cap-suggest-accept"]', onSuggestAccept);
    delegate(receiptEl, 'click', '[data-role="cap-suggest-dismiss"]', onSuggestDismiss);
}

// ---- capture flow ----------------------------------------------------------

function handleSubmit() {
    const text = (inputEl.value || '').trim();
    if (!text) return;

    const s = store.getState();
    const currency = s.settings?.currency;
    const result = parse(text, {
        categories: s.categories,
        todayStr: getLocalDateString(new Date()),
        currencyCode: currency,
        learned: getLearnedLookup(s.categories)
    });
    const logId = logInteraction({ rawText: text, engine: 'parser', entries: result.entries });

    if (!result.entries.length) {
        markOutcome(logId, { cancelled: true });
        renderMessage('I couldn’t read any amounts in that. Try: ' , 'breakfast 120, rickshaw 50');
        return;
    }

    // Save everything optimistically; a wrong guess is flagged, never dropped.
    const base = Date.now();
    const saved = [];
    const accepted = [];
    const errors = [];
    result.entries.forEach((e, i) => {
        const res = add({
            id: String(base + i),
            date: e.date,
            category: e.category,
            subcategory: e.subcategory,
            amount: e.amount,
            description: e.description,
            currency
        }, { isIncomeCategory });
        if (res.ok) { saved.push({ ...res.expense, needsReview: !!e.needsReview }); accepted.push(e); }
        else errors.push(`${e.description || e.subcategory}: ${res.error}`);
    });

    markOutcome(logId, { acceptedIds: saved.map(x => x.id) });
    if (accepted.length) recordOutcome(accepted);
    inputEl.value = '';
    renderReceipt(saved, result.unmatched, errors);
}

// ---- receipt ---------------------------------------------------------------

function renderReceipt(saved, unmatched, errors) {
    const currency = store.getState().settings?.currency;
    receiptEl.replaceChildren();

    receiptEl.append(summaryLine(saved, currency));

    for (const e of saved) {
        const income = isIncomeCategory(e.category);
        receiptEl.append(
            el('div', {
                class: 'cap-row' + (e.needsReview ? ' cap-review' : ''),
                dataset: { id: String(e.id), amount: String(e.amount), income: income ? '1' : '0' }
            },
                el('button', {
                    class: 'cap-row-main',
                    dataset: { role: 'cap-amend', id: String(e.id) },
                    title: 'Tap to fix'
                },
                    el('span', { class: 'cap-main' },
                        `${e.category} › ${e.subcategory} — ${formatCurrency(e.amount, currency)}${e.needsReview ? ' ⚠' : ''}`),
                    el('span', { class: 'cap-meta' },
                        `${formatDate(e.date)}${e.description ? ' · ' + e.description : ''}`)
                ),
                el('button', {
                    class: 'cap-undo',
                    dataset: { role: 'cap-undo', id: String(e.id) },
                    title: 'Undo', 'aria-label': 'Undo this entry'
                }, '✕')
            )
        );
    }

    if (unmatched && unmatched.length) {
        receiptEl.append(el('p', { class: 'cap-note' }, `Couldn’t read: ${unmatched.join(' · ')}`));
    }
    for (const err of (errors || [])) {
        receiptEl.append(el('p', { class: 'cap-error' }, err));
    }
    appendSuggestion();
    setVisible(receiptEl, true);
}

/** One-line "create a subcategory?" offer for a word that keeps missing. */
function appendSuggestion() {
    const sug = nextSuggestion(store.getState().categories);
    if (!sug) return;
    receiptEl.append(
        el('div', { class: 'cap-suggest', dataset: { role: 'cap-suggest' } },
            el('span', {}, `“${sug.word}” keeps landing in ${sug.category} — create a “${sug.label}” subcategory?`),
            el('button', {
                class: 'cap-suggest-btn',
                dataset: { role: 'cap-suggest-accept', word: sug.word, label: sug.label, category: sug.category }
            }, '✓ Create'),
            el('button', {
                class: 'cap-suggest-btn cap-suggest-no',
                dataset: { role: 'cap-suggest-dismiss', word: sug.word }
            }, 'No')
        )
    );
}

/** Build the "✓ N logged · ৳ out · ৳ in" summary from the rows still present. */
function summaryLine(saved, currency) {
    let out = 0, inc = 0, count = 0;
    for (const e of saved) {
        count++;
        if (isIncomeCategory(e.category)) inc += Number(e.amount) || 0;
        else out += Number(e.amount) || 0;
    }
    return renderSummaryNode(count, out, inc, currency);
}

function renderSummaryNode(count, out, inc, currency) {
    const parts = [`✓ ${count} logged`];
    if (out > 0) parts.push(`${formatCurrency(out, currency)} out`);
    if (inc > 0) parts.push(`${formatCurrency(inc, currency)} in`);
    return el('div', { class: 'cap-summary', dataset: { role: 'cap-summary' } }, parts.join(' · '));
}

/** Recompute the summary from the rows still in the DOM (after an undo). */
function refreshSummary() {
    const currency = store.getState().settings?.currency;
    const rows = $$('.cap-row', receiptEl);
    let out = 0, inc = 0;
    for (const r of rows) {
        const amt = Number(/** @type {HTMLElement} */ (r).dataset.amount) || 0;
        if (/** @type {HTMLElement} */ (r).dataset.income === '1') inc += amt;
        else out += amt;
    }
    const node = renderSummaryNode(rows.length, out, inc, currency);
    const existing = $('[data-role="cap-summary"]', receiptEl);
    if (existing) existing.replaceWith(node);
}

function renderMessage(text, example) {
    receiptEl.replaceChildren(
        el('p', { class: 'cap-note' }, text, el('em', {}, example))
    );
    setVisible(receiptEl, true);
}

// ---- row actions -----------------------------------------------------------

function onAmend(_ev, btn) {
    const id = /** @type {HTMLElement} */ (btn).dataset.id;
    if (id) openEditModal(id);
}

function onUndo(_ev, btn) {
    const id = /** @type {HTMLElement} */ (btn).dataset.id;
    if (!id) return;
    remove(id);
    const row = /** @type {Element} */ (btn).closest('.cap-row');
    if (row) row.remove();
    if (!$$('.cap-row', receiptEl).length) setVisible(receiptEl, false);
    else refreshSummary();
}

function onSuggestAccept(_ev, btn) {
    const { word, label, category } = /** @type {HTMLElement} */ (btn).dataset;
    const res = addSubcategory(category, label);
    if (!res.ok && res.error !== 'Subcategory already exists') return;
    acceptSuggestion(word, category, label);
    const row = /** @type {Element} */ (btn).closest('[data-role="cap-suggest"]');
    if (row) row.replaceChildren(el('span', {}, `✓ “${label}” added under ${category} — I'll file “${word}” there from now on.`));
}

function onSuggestDismiss(_ev, btn) {
    dismissSuggestion(/** @type {HTMLElement} */ (btn).dataset.word);
    const row = /** @type {Element} */ (btn).closest('[data-role="cap-suggest"]');
    if (row) row.remove();
}
