// js/core/events.js
// Event name constants for the store. Use these instead of string literals.

export const EVENTS = Object.freeze({
    /** Fired after any store update. Listener receives full state. */
    STATE_CHANGED:      'state:changed',

    EXPENSES_CHANGED:   'expenses:changed',
    CATEGORIES_CHANGED: 'categories:changed',
    SETTINGS_CHANGED:   'settings:changed',
    FILTERS_CHANGED:    'filters:changed',
    USER_CHANGED:       'user:changed',
    SYNC_STATUS_CHANGED:'sync:changed',

    /** UI-only events (not part of persistent state). */
    TOAST:              'ui:toast',
    THEME_CHANGED:      'ui:theme'
});
