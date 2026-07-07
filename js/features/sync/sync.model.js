// js/features/sync/sync.model.js
// Pure conflict-resolution logic for the offline sync queue. NO DOM.
// The interactive dialog is injected as `confirmFn` so tests can stub it.

/** @typedef {import('../../core/schema.js').Expense} Expense */

const COMPARE_FIELDS = ['date', 'category', 'subcategory', 'amount', 'description', 'currency'];

/** Effective type for comparison: legacy sheet rows have type '' — infer it. */
function effectiveType(e) {
    if (e.type === 'income' || e.type === 'expense') return e.type;
    return e.category === 'Income' ? 'income' : 'expense';
}

/**
 * Field-by-field equality, immune to key order and string/number drift.
 * Excludes `timestamp` (server-assigned) and compares id via String().
 * @param {Expense} a  @param {Expense} b
 */
export function sameExpense(a, b) {
    if (!a || !b) return a === b;
    if (String(a.id) !== String(b.id)) return false;
    if (effectiveType(a) !== effectiveType(b)) return false;
    for (const f of COMPARE_FIELDS) {
        if (f === 'amount') {
            if (Number(a.amount) !== Number(b.amount)) return false;
        } else {
            const va = String(a[f] ?? '').trim();
            const vb = String(b[f] ?? '').trim();
            if (va !== vb) return false;
        }
    }
    return true;
}

/**
 * Iterates through the offline queue and resolves conflicts with remote data interactively.
 * @param {Expense[]} remoteExpenses
 * @param {import('../../core/schema.js').SyncQueueItem[]} queue
 * @param {Date|null} lastSync
 * @param {(opts: object) => Promise<boolean>} confirmFn
 * @returns {Promise<Expense[]>}
 */
export async function resolveConflictQueue(remoteExpenses, queue, lastSync, confirmFn) {
    let resolvedList = [...remoteExpenses];

    for (const item of queue) {
        if (item.action === 'delete' && item.id === 'all') {
            const wipedAt = item.timestamp ? new Date(item.timestamp) : null;
            resolvedList = wipedAt
                ? resolvedList.filter(e => e.timestamp && new Date(e.timestamp) > wipedAt)
                : [];
            continue;
        }

        const remoteItem = resolvedList.find(e => String(e.id) === String(item.id));

        if (item.action === 'add') {
            if (remoteItem) {
                // Added on both sides: compare fields
                if (!sameExpense(item.expense, remoteItem)) {
                    const keepLocal = await confirmFn({
                        title: 'Sync Conflict (Add)',
                        message: `A transaction was added on both devices with matching ID.\n\n` +
                                 `Local: ${item.expense.category} (${item.expense.subcategory}) - $${item.expense.amount} on ${item.expense.date}\n` +
                                 `Cloud: ${remoteItem.category} (${remoteItem.subcategory}) - $${remoteItem.amount} on ${remoteItem.date}\n\n` +
                                 `Keep your local version?`,
                        confirmText: 'Keep Local',
                        cancelText: 'Use Cloud',
                        tone: 'warn'
                    });
                    if (keepLocal) {
                        resolvedList = resolvedList.map(e => String(e.id) === String(item.id) ? item.expense : e);
                    }
                }
            } else {
                resolvedList.push(item.expense);
            }
        } else if (item.action === 'update') {
            if (remoteItem) {
                if (!sameExpense(item.expense, remoteItem)) {
                    // Check if cloud version changed since last sync
                    const remoteModifiedTime = remoteItem.timestamp ? new Date(remoteItem.timestamp) : null;
                    const remoteChanged = lastSync && remoteModifiedTime && remoteModifiedTime > lastSync;

                    if (remoteChanged) {
                        const keepLocal = await confirmFn({
                            title: 'Sync Conflict (Edit)',
                            message: `Transaction was edited on both devices since last sync.\n\n` +
                                     `Local: ${item.expense.category} - $${item.expense.amount} on ${item.expense.date} (${item.expense.description || 'no note'})\n` +
                                     `Cloud: ${remoteItem.category} - $${remoteItem.amount} on ${remoteItem.date} (${remoteItem.description || 'no note'})\n\n` +
                                     `Keep your local version?`,
                            confirmText: 'Keep Local',
                            cancelText: 'Use Cloud',
                            tone: 'warn'
                        });
                        if (keepLocal) {
                            resolvedList = resolvedList.map(e => String(e.id) === String(item.id) ? item.expense : e);
                        }
                    } else {
                        // Only modified locally, auto-apply local edit
                        resolvedList = resolvedList.map(e => String(e.id) === String(item.id) ? item.expense : e);
                    }
                }
            } else {
                // Deleted in cloud, edited locally
                const restore = await confirmFn({
                    title: 'Sync Conflict (Deleted on Cloud)',
                    message: `Transaction (${item.expense.category} - $${item.expense.amount}) was deleted from the cloud but modified locally.\n\n` +
                             `Restore this transaction?`,
                    confirmText: 'Restore',
                    cancelText: 'Keep Deleted',
                    tone: 'warn'
                });
                if (restore) {
                    resolvedList.push(item.expense);
                }
            }
        } else if (item.action === 'delete') {
            if (remoteItem) {
                // Deleted locally: check if edited in cloud since last sync
                const remoteModifiedTime = remoteItem.timestamp ? new Date(remoteItem.timestamp) : null;
                const remoteChanged = lastSync && remoteModifiedTime && remoteModifiedTime > lastSync;

                if (remoteChanged) {
                    const keepCloud = await confirmFn({
                        title: 'Sync Conflict (Deleted Locally)',
                        message: `Transaction was deleted locally but edited on another device.\n\n` +
                                 `Cloud: ${remoteItem.category} - $${remoteItem.amount} on ${remoteItem.date}\n\n` +
                                 `Keep the Cloud version?`,
                        confirmText: 'Keep Cloud',
                        cancelText: 'Keep Delete',
                        tone: 'warn'
                    });
                    if (!keepCloud) {
                        resolvedList = resolvedList.filter(e => String(e.id) !== String(item.id));
                    }
                } else {
                    // Only deleted locally, auto-apply delete
                    resolvedList = resolvedList.filter(e => String(e.id) !== String(item.id));
                }
            }
        }
    }
    return resolvedList;
}
