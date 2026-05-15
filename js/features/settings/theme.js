// js/features/settings/theme.js
// Applies the current theme to <html data-theme="..."> whenever settings change.
// Owns the #theme-select <select> too: keeps it in sync with state and writes
// back to localStorage + storage + store on user change.

import { $ } from '../../core/dom.js';
import { THEMES } from '../../core/constants.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { storage } from '../../services/storage.js';

/** @param {string} themeName */
function applyTheme(themeName) {
    const name = THEMES.includes(themeName) ? themeName : 'dark';
    if (name === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', name);

    const sel = /** @type {HTMLSelectElement|null} */ ($('#theme-select'));
    if (sel && sel.value !== name) sel.value = name;
}

function handleChange() {
    const sel = /** @type {HTMLSelectElement|null} */ ($('#theme-select'));
    if (!sel) return;
    const next = { ...(store.getState().settings || {}), theme: sel.value };
    try { localStorage.setItem('settings', JSON.stringify(next)); } catch (_) {}
    storage.saveSettings(next);
    store.update({ settings: next }, EVENTS.SETTINGS_CHANGED);
}

export function mountTheme() {
    applyTheme(store.getState().settings?.theme);
    store.subscribe(EVENTS.SETTINGS_CHANGED, (s) => applyTheme(s.settings?.theme));

    const sel = $('#theme-select');
    if (sel) sel.addEventListener('change', handleChange);
}
