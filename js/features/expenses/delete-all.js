// js/features/expenses/delete-all.js
// "Delete all" flow for the History page's red trash button.
// Branches:
//   - guest mode: single confirm, wipe local.
//   - signed in:  prompt (1 = everything incl. sheet, 2 = device-only,
//                          anything else = cancel).
// The store subscriptions (stats, list, charts, budget) re-render
// automatically once the expenses list is replaced.

import { store } from '../../core/store.js';
import { $ } from '../../core/dom.js';
import { showToast } from '../../core/toast.js';
import { storage } from '../../services/storage.js';
import { dialog } from '../../services/dialog.js';
import { pullFromCloud, updateSyncStatus } from '../sync/index.js';
import * as actions from './actions.js';

export async function handleDeleteAll() {
    const { expenses } = store.getState();

    if (expenses.length === 0) {
        showToast('No expenses to delete', 'warning');
        return;
    }

    // Guest / not signed in — single, clear confirm.
    if (!storage.isCloud()) {
        const ok = await dialog.confirm({
            title: `Delete all ${expenses.length} entries?`,
            message: 'This cannot be undone.',
            confirmText: 'Delete all',
            tone: 'danger'
        });
        if (!ok) return;
        actions.setAll([]);
        showToast('Local data cleared', 'success');
        return;
    }

    // Signed in — prompt for one of three outcomes.
    const choice = await dialog.prompt({
        title: 'Reset data',
        message:
            'Choose what to delete:\n' +
            '  1  Everything (local + your Google Sheet)\n' +
            '  2  This device only (sheet stays; resyncs later)\n' +
            'Leave blank or press Cancel to keep your data.',
        placeholder: '1 or 2',
        confirmText: 'Continue'
    });
    const normalized = (choice || '').trim().toLowerCase();

    if (normalized === '1') {
        const ok = await dialog.confirm({
            title: 'Final confirmation',
            message: 'Delete ALL entries from this device AND your Google Sheet?\n\nThis cannot be undone.',
            confirmText: 'Delete everything',
            tone: 'danger'
        });
        if (!ok) return;
        actions.setAll([]);
        try {
            updateSyncStatus('syncing');
            await storage.deleteAllExpenses();
            updateSyncStatus('synced');
        } catch (e) {
            console.error(e);
            updateSyncStatus('error');
            await dialog.alert({
                title: 'Sheet not cleared',
                message: 'Local data was cleared, but the Google Sheet could not be cleared. Please try again from the Profile page (Pull / Push).',
                tone: 'error'
            });
        }
        showToast('All data cleared', 'success');
    } else if (normalized === '2') {
        const ok = await dialog.confirm({
            title: 'Clear this device only?',
            message: 'Your Google Sheet stays untouched. Local data will be repopulated from the sheet on next sync.',
            confirmText: 'Clear device',
            tone: 'warn'
        });
        if (!ok) return;
        actions.setAll([]);
        showToast('Local data cleared (sheet preserved)', 'success');
        // Pull cloud data back so the user isn't left with a confusingly empty UI.
        pullFromCloud();
    }
    // any other input = cancel
}

export function mount() {
    const btn = $('#delete-all');
    if (btn) btn.addEventListener('click', handleDeleteAll);
}
