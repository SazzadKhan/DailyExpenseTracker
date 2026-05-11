// js/features/settings/theme.js
// Applies the current theme to <html data-theme="..."> whenever settings change.
// Also keeps the #theme-select control in sync with state.

import { $ } from '../../core/dom.js';
import { THEMES } from '../../core/constants.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';

/** @param {string} themeName */
function applyTheme(themeName) {
    const name = THEMES.includes(themeName) ? themeName : 'dark';
    if (name === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', name);

    const sel = /** @type {HTMLSelectElement|null} */ ($('#theme-select'));
    if (sel && sel.value !== name) sel.value = name;
}

export function mountTheme() {
    applyTheme(store.getState().settings?.theme);
    store.subscribe(EVENTS.SETTINGS_CHANGED, (s) => applyTheme(s.settings?.theme));
}
