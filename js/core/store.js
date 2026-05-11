// js/core/store.js
// Tiny reactive store. Single source of truth for app state.
//
// Usage:
//   import { store } from './store.js';
//   store.subscribe(EVENTS.EXPENSES_CHANGED, state => renderExpenses(state.expenses));
//   store.update({ expenses: [...state.expenses, newOne] }, EVENTS.EXPENSES_CHANGED);
//
// Rules:
//   - Never mutate `store.getState()` results. Treat as read-only.
//   - Always go through `update()` so subscribers fire.
//   - Pass the most specific event you can; STATE_CHANGED is also fired.

import { EVENTS } from './events.js';

/** @typedef {import('./schema.js').AppState} AppState */

const listeners = new Map(); // event -> Set<fn>

/** @type {AppState} */
let state = /** @type {any} */ ({
    expenses: [],
    categories: {},
    settings: null,
    user: null,
    isSyncing: false,
    lastSyncTime: null,
    authMode: null,
    filters: { dateFrom: '', dateTo: '', category: '', search: '' }
});

function emit(event) {
    const set = listeners.get(event);
    if (set) for (const fn of set) {
        try { fn(state); } catch (err) { console.error(`[store:${event}]`, err); }
    }
    if (event !== EVENTS.STATE_CHANGED) emit(EVENTS.STATE_CHANGED);
}

export const store = {
    /** @returns {AppState} */
    getState() { return state; },

    /**
     * Replace listed top-level keys. Pass one or more event names to notify.
     * @param {Partial<AppState>} patch
     * @param {...string} events
     */
    update(patch, ...events) {
        state = { ...state, ...patch };
        if (events.length === 0) emit(EVENTS.STATE_CHANGED);
        else for (const ev of events) emit(ev);
    },

    /**
     * Initial hydration — sets state without firing per-key events.
     * Use only once at startup.
     * @param {Partial<AppState>} initial
     */
    hydrate(initial) {
        state = { ...state, ...initial };
        emit(EVENTS.STATE_CHANGED);
    },

    /**
     * Subscribe to an event. Returns an unsubscribe function.
     * @param {string} event
     * @param {(state: AppState) => void} fn
     */
    subscribe(event, fn) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(fn);
        return () => listeners.get(event)?.delete(fn);
    }
};
