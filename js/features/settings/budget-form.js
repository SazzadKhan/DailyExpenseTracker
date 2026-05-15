// js/features/settings/budget-form.js
// Owns the "Alerts" tab (#warning-threshold, #enable-notifications,
// #save-budget) and the settings-tab switcher. Reads the current values
// from the store on mount; writes back via the storage service + bridge.

import { $, $$ } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { showToast } from '../../core/toast.js';
import { storage } from '../../services/storage.js';

function loadForm() {
    const s = store.getState().settings || {};
    const budget = /** @type {HTMLInputElement|null} */ ($('#monthly-budget'));
    const thr    = /** @type {HTMLInputElement|null} */ ($('#warning-threshold'));
    const notif  = /** @type {HTMLInputElement|null} */ ($('#enable-notifications'));
    if (budget) budget.value = String(s.monthlyBudget || '');
    if (thr)    thr.value    = String(s.warningThreshold ?? 80);
    if (notif)  notif.checked = s.enableNotifications !== false;
}

function switchTab(tab) {
    for (const t of $$('.settings-tab')) t.classList.remove('active');
    const activeTab = document.querySelector(`[data-tab="${tab}"]`);
    if (activeTab) activeTab.classList.add('active');

    for (const c of $$('.settings-content')) c.classList.add('hidden');
    const pane = $(`#${tab}-tab`);
    if (pane) pane.classList.remove('hidden');
}

function save() {
    const current = store.getState().settings || {};
    const next = {
        ...current,
        monthlyBudget: parseFloat(/** @type {HTMLInputElement} */ ($('#monthly-budget'))?.value) || 0,
        warningThreshold: parseInt(/** @type {HTMLInputElement} */ ($('#warning-threshold'))?.value, 10) || 80,
        enableNotifications: !!/** @type {HTMLInputElement} */ ($('#enable-notifications'))?.checked
    };

    try { localStorage.setItem('settings', JSON.stringify(next)); } catch (_) {}
    storage.saveSettings(next);
    store.update({ settings: next }, EVENTS.SETTINGS_CHANGED);

    showToast('Income settings saved!', 'success');
}

export function mountBudgetForm() {
    loadForm();
    store.subscribe(EVENTS.SETTINGS_CHANGED, loadForm);

    for (const tab of $$('.settings-tab')) {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    }

    const saveBtn = $('#save-budget');
    if (saveBtn) saveBtn.addEventListener('click', save);
}
