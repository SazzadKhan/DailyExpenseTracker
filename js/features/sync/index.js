// js/features/sync/index.js
// Google Sheets cloud sync. Delegates the heavy lifting to the storage
// facade in js/services/storage.js; this module owns:
//   - the `pull` / `push` flows (state + sync-status UI),
//   - the `#sync-status` pill rendering,
//   - the auto-pull interval.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { $ } from '../../core/dom.js';
import { normalizeDateString } from '../../core/format.js';
import { DEFAULT_CATEGORIES } from '../../core/constants.js';
import { storage } from '../../services/storage.js';
import { log } from '../../core/log.js';

const $log = log('sync');

const AUTO_PULL_INTERVAL_MS = 5 * 60 * 1000;

/** @type {Date|null} */ let lastSyncTime = null;
let isSyncing = false;

export function getLastSyncTime() { return lastSyncTime; }

/**
 * Render the `#sync-status` pill.
 * @param {'syncing'|'synced'|'error'|'offline'|''} status
 */
export function updateSyncStatus(status) {
    const el = $('#sync-status');
    if (!el) return;
    el.className = 'sync-status';
    el.hidden = false;
    switch (status) {
        case 'syncing':
            el.innerHTML = '🔄 Syncing…';
            el.classList.add('syncing');
            break;
        case 'synced': {
            const time = lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'now';
            el.innerHTML = `☁️ Synced ${time}`;
            el.classList.add('synced');
            break;
        }
        case 'error':
            el.innerHTML = '⚠️ Sync failed';
            el.classList.add('error');
            break;
        case 'offline':
            el.innerHTML = '📴 Local only';
            el.classList.add('offline');
            break;
        default:
            el.innerHTML = '';
            el.hidden = true;
    }
}

/** Pull all data from the cloud backend into the store. */
export async function pullFromCloud() {
    if (!storage.isCloud() || isSyncing) return;
    isSyncing = true;
    updateSyncStatus('syncing');

    try {
        const data = await storage.pullAll();
        if (data) {
            // Replace unconditionally — empty sheet ⇒ empty local copy.
            const incoming = Array.isArray(data.expenses) ? data.expenses : [];
            const expenses = incoming.map(exp => {
                if (exp.date) exp.date = normalizeDateString(exp.date);
                return exp;
            });
            localStorage.setItem('expenses', JSON.stringify(expenses));
            store.update({ expenses }, EVENTS.EXPENSES_CHANGED);

            // Settings
            const currentSettings = store.getState().settings;
            let settings = currentSettings;
            if (data.settings && Object.keys(data.settings).length > 0) {
                settings = { ...currentSettings, ...data.settings };
                localStorage.setItem('settings', JSON.stringify(settings));
            } else {
                storage.saveSettings(currentSettings);
            }
            store.update({ settings }, EVENTS.SETTINGS_CHANGED);

            // Categories
            const currentCategories = store.getState().categories;
            let categories = currentCategories;
            if (data.categories && Object.keys(data.categories).length > 0) {
                categories = data.categories;
                if (!categories.Income) {
                    categories.Income = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES.Income));
                    storage.saveCategories(categories);
                }
                localStorage.setItem('categories', JSON.stringify(categories));
            } else {
                storage.saveCategories(currentCategories);
            }
            store.update({ categories }, EVENTS.CATEGORIES_CHANGED);
        }

        lastSyncTime = new Date();
        updateSyncStatus('synced');
    } catch (err) {
        $log.error('pull failed', err);
        updateSyncStatus('error');
    } finally {
        isSyncing = false;
    }
}

/** Push the current store snapshot to the cloud backend. */
export async function pushAllToCloud() {
    if (!storage.isCloud()) return;
    updateSyncStatus('syncing');
    try {
        const { expenses, settings, categories } = store.getState();
        await storage.pushAll({ expenses, settings, categories });
        lastSyncTime = new Date();
        updateSyncStatus('synced');
    } catch (err) {
        $log.error('push failed', err);
        updateSyncStatus('error');
    }
}

export function mount() {
    // Auto-pull every 5 minutes when signed in.
    setInterval(() => {
        if (storage.isCloud()) pullFromCloud();
    }, AUTO_PULL_INTERVAL_MS);

    // Mirror sync errors / status pings emitted via the store (future).
    store.subscribe(EVENTS.SYNC_STATUS_CHANGED, (state) => {
        if (state?.syncStatus) updateSyncStatus(state.syncStatus);
    });
}
