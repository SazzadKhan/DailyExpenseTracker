// js/features/expenses/actions.js
// Expense CRUD orchestration: validate → store update → local persist →
// cloud sync (best-effort). Each action returns the NEW list.
//
// Cloud sync: uses the storage facade from js/services/storage.js.
// Failures are swallowed and logged — the local truth has already been
// written, and the existing cloud layer handles its own retry/queue.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { saveExpenses } from '../../services/local-store.js';
import { storage } from '../../services/storage.js';
import { log } from '../../core/log.js';
import {
    validateExpense,
    addExpense   as modelAdd,
    updateExpense as modelUpdate,
    deleteExpense as modelDelete,
    deleteAll    as modelDeleteAll
} from './expenses.model.js';

/** @typedef {import('../../core/schema.js').Expense} Expense */
/** @typedef {import('../../core/schema.js').SyncQueueItem} SyncQueueItem */

const $log = log('expenses/actions');

export function getQueue() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

export function saveQueue(queue) {
    try {
        localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (_) {}
    store.update({ syncQueue: queue }, EVENTS.SYNC_QUEUE_CHANGED);
}

export function addToQueue(item) {
    if (!storage.isCloud()) return;
    const queue = getQueue();
    queue.push(item);
    saveQueue(queue);
}

function commit(nextList, cloudOp, queueItem = null) {
    store.update({ expenses: nextList }, EVENTS.EXPENSES_CHANGED);
    saveExpenses(nextList);
    if (typeof cloudOp === 'function') {
        Promise.resolve(cloudOp()).catch(err => {
            $log.warn('cloud sync failed (local already saved), adding to queue', err);
            if (queueItem) {
                addToQueue(queueItem);
            }
        });
    }
    return nextList;
}

/**
 * Validate raw form input, append the expense, persist, and sync.
 * @param {Partial<Expense> & {amount:number|string}} input
 * @param {{ isIncomeCategory?: (name:string)=>boolean }} [opts]
 * @returns {{ ok:true, expense:Expense, list:Expense[] } | { ok:false, error:string }}
 */
export function add(input, opts = {}) {
    const s = store.getState();
    const v = validateExpense(input, {
        defaultCurrency: s.settings?.currency,
        isIncomeCategory: opts.isIncomeCategory
    });
    if (!v.ok) return v;

    const list = modelAdd(s.expenses, v.expense);
    const queueItem = {
        action: 'add',
        id: v.expense.id,
        expense: v.expense,
        timestamp: v.expense.timestamp
    };
    commit(list, () => storage.addExpense(v.expense), queueItem);
    return { ok: true, expense: v.expense, list };
}

/**
 * Validate, replace an existing expense by id, persist, and sync.
 * @param {Partial<Expense> & {amount:number|string}} input
 * @param {{ isIncomeCategory?: (name:string)=>boolean }} [opts]
 * @returns {{ ok:true, expense:Expense, list:Expense[] } | { ok:false, error:string }}
 */
export function update(input, opts = {}) {
    const s = store.getState();
    const inputWithTimestamp = { ...input, timestamp: new Date().toISOString() };
    const v = validateExpense(inputWithTimestamp, {
        defaultCurrency: s.settings?.currency,
        isIncomeCategory: opts.isIncomeCategory
    });
    if (!v.ok) return v;

    const list = modelUpdate(s.expenses, v.expense);
    const queueItem = {
        action: 'update',
        id: v.expense.id,
        expense: v.expense,
        timestamp: v.expense.timestamp
    };
    commit(list, () => storage.updateExpense(v.expense), queueItem);
    return { ok: true, expense: v.expense, list };
}

/**
 * Remove an expense by id.
 * @param {string|number} id
 * @returns {Expense[]} new list
 */
export function remove(id) {
    const s = store.getState();
    const list = modelDelete(s.expenses, id);
    const queueItem = {
        action: 'delete',
        id: String(id),
        timestamp: new Date().toISOString()
    };
    commit(list, () => storage.deleteExpense(String(id)), queueItem);
    return list;
}

/**
 * Wipe all expenses. Used by "Delete all" in settings.
 * @returns {Expense[]} empty list
 */
export function removeAll() {
    const list = modelDeleteAll();
    const queueItem = {
        action: 'delete',
        id: 'all',
        timestamp: new Date().toISOString()
    };
    commit(list, () => storage.deleteAllExpenses(), queueItem);
    return list;
}

/**
 * Replace the entire list. Used after CSV import or cloud pull.
 * Skips validation — the caller is responsible for it.
 * @param {Expense[]} list
 * @returns {Expense[]}
 */
export function setAll(list) {
    return commit(Array.isArray(list) ? list : [], null);
}
