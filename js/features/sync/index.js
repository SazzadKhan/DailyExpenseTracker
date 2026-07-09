import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { $ } from '../../core/dom.js';
import { normalizeDateString } from '../../core/format.js';
import { DEFAULT_CATEGORIES, STORAGE_KEYS } from '../../core/constants.js';
import { storage } from '../../services/storage.js';
import { log } from '../../core/log.js';
import { getQueue, saveQueue } from '../expenses/actions.js';
import { saveExpenses, saveSettings as persistSettings, saveCategories as persistCategories } from '../../services/local-store.js';
import { dialog } from '../../services/dialog.js';
import { showToast } from '../../core/toast.js';
import { resolveConflictQueue } from './sync.model.js';

const $log = log('sync');

const AUTO_PULL_INTERVAL_MS = 5 * 60 * 1000;

/** @type {Date|null} */
let lastSyncTime = (() => {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
        return raw ? new Date(raw) : null;
    } catch (_) {
        return null;
    }
})();

function setLastSyncTime(date) {
    lastSyncTime = date;
    try {
        if (date) {
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, date.toISOString());
        } else {
            localStorage.removeItem(STORAGE_KEYS.LAST_SYNC_TIME);
        }
    } catch (_) {}
}

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
            const incoming = Array.isArray(data.expenses) ? data.expenses : [];
            const remoteExpenses = incoming.map(exp => {
                if (exp.date) exp.date = normalizeDateString(exp.date);
                return exp;
            });

            const queue = getQueue();
            let finalExpenses = remoteExpenses;
            let wroteBackToCloud = false;

            if (queue.length > 0) {
                $log.info(`Sync queue has ${queue.length} items; starting conflict resolution`);
                finalExpenses = await resolveConflictQueue(remoteExpenses, queue, lastSyncTime, (opts) => dialog.confirm(opts));
                wroteBackToCloud = true;
            }

            // Save the merged list locally
            saveExpenses(finalExpenses);
            store.update({ expenses: finalExpenses }, EVENTS.EXPENSES_CHANGED);

            // Settings
            const currentSettings = store.getState().settings;
            let settings = currentSettings;
            if (data.settings && Object.keys(data.settings).length > 0) {
                settings = { ...currentSettings, ...data.settings };
                persistSettings(settings);
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
                persistCategories(categories);
            } else {
                storage.saveCategories(currentCategories);
            }
            store.update({ categories }, EVENTS.CATEGORIES_CHANGED);

            // If we processed offline changes, write the merged results back to Google Sheets
            if (wroteBackToCloud) {
                await storage.replaceAllExpenses(finalExpenses);
                saveQueue([]); // Only safe to drop the queue once the cloud write-back succeeded
                showToast('Offline sync resolved successfully!');
            }
        }

        setLastSyncTime(new Date());
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
    if (!storage.isCloud() || isSyncing) return;
    isSyncing = true;
    updateSyncStatus('syncing');
    try {
        const { expenses, settings, categories } = store.getState();
        await storage.pushAll({ expenses, settings, categories });
        saveQueue([]); // Clear any pending sync items if wholesale overwrite succeeds
        setLastSyncTime(new Date());
        updateSyncStatus('synced');
    } catch (err) {
        $log.error('push failed', err);
        updateSyncStatus('error');
    } finally {
        isSyncing = false;
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

    // Auto-sync when returning online
    window.addEventListener('online', () => {
        if (storage.isCloud()) {
            $log.info('Connection restored; auto-syncing');
            pullFromCloud();
        }
    });
}
