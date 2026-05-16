// js/features/settings/currency.js
// Owns the currency <select> and the symbol display in form labels.
// Reflects the active currency on SETTINGS_CHANGED; writes back via
// localStorage + storage service + bridge on user change.

import { $, $$ } from '../../core/dom.js';
import { CURRENCIES } from '../../core/constants.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { storage } from '../../services/storage.js';

function paintCurrency(code) {
    const sym = (CURRENCIES[code] || CURRENCIES.USD).symbol;
    const amountEl = $('#amount-currency');
    if (amountEl) amountEl.textContent = sym;
    for (const el of $$('.edit-currency')) el.textContent = `(${sym})`;
    const sel = /** @type {HTMLSelectElement|null} */ ($('#currency-select'));
    if (sel && code && sel.value !== code) sel.value = code;
}

function handleChange() {
    const sel = /** @type {HTMLSelectElement|null} */ ($('#currency-select'));
    if (!sel) return;
    const next = { ...(store.getState().settings || {}), currency: sel.value };
    try { localStorage.setItem('settings', JSON.stringify(next)); } catch (_) {}
    storage.saveSettings(next);
    store.update({ settings: next }, EVENTS.SETTINGS_CHANGED);
}

export function mountCurrency() {
    paintCurrency(store.getState().settings?.currency);
    store.subscribe(EVENTS.SETTINGS_CHANGED, (s) => paintCurrency(s.settings?.currency));

    const sel = $('#currency-select');
    if (sel) sel.addEventListener('change', handleChange);
}
