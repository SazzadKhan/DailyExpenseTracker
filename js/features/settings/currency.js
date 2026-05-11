// js/features/settings/currency.js
// Reflects the active currency symbol in form labels (#amount-currency,
// .edit-currency). Pure read-side — write happens in legacy app.js via the
// currency <select>, which calls saveSettings() and notifies the store.

import { $, $$ } from '../../core/dom.js';
import { CURRENCIES } from '../../core/constants.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';

function paintCurrency(code) {
    const sym = (CURRENCIES[code] || CURRENCIES.USD).symbol;
    const amountEl = $('#amount-currency');
    if (amountEl) amountEl.textContent = sym;
    for (const el of $$('.edit-currency')) el.textContent = `(${sym})`;
}

export function mountCurrency() {
    paintCurrency(store.getState().settings?.currency);
    store.subscribe(EVENTS.SETTINGS_CHANGED, (s) => paintCurrency(s.settings?.currency));
}
