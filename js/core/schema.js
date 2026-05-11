// js/core/schema.js
// Authoritative data shapes (JSDoc) + storage schema versioning.
//
// To change a stored shape:
//   1. Bump SCHEMA_VERSION.
//   2. Add a case to `migrate()`.
//   3. Update the relevant @typedef.

export const SCHEMA_VERSION = 1;

/**
 * @typedef {'expense' | 'income'} EntryType
 */

/**
 * @typedef {object} Expense
 * @property {string}    id           Stable unique id (timestamp-based).
 * @property {EntryType} type         'expense' or 'income'.
 * @property {string}    date         Local date, format `YYYY-MM-DD`. See core/format.js.
 * @property {string}    category     Category name (must exist in Categories).
 * @property {string}    subcategory  Subcategory name.
 * @property {number}    amount       Positive number. Sign is implied by `type`.
 * @property {string}    description  Free-text note. May be empty.
 * @property {string}    currency     ISO code, e.g. 'USD'. Must exist in CURRENCIES.
 */

/**
 * @typedef {object} Category
 * @property {string}   icon          Single emoji.
 * @property {string[]} subcategories Subcategory names. Order is preserved.
 */

/**
 * @typedef {Object<string, Category>} Categories
 */

/**
 * @typedef {object} Settings
 * @property {string}  currency             ISO code, default 'USD'.
 * @property {number}  monthlyBudget        Legacy; budget is derived from income.
 * @property {number}  warningThreshold     50–100, percent of income that triggers warning.
 * @property {boolean} enableNotifications  Toggle for in-app alerts.
 * @property {'dark'|'panda'|'peaceful'|'edgy'} theme
 */

/**
 * @typedef {object} UserProfile
 * @property {string}      email
 * @property {string}      name
 * @property {string|null} picture
 * @property {string}      sub      OAuth subject id.
 */

/**
 * @typedef {object} AppState
 * @property {Expense[]}         expenses
 * @property {Categories}        categories
 * @property {Settings}          settings
 * @property {UserProfile|null}  user
 * @property {boolean}           isSyncing
 * @property {number|null}       lastSyncTime  ms epoch
 * @property {'guest'|'google'|null} authMode
 * @property {FilterState}       filters
 */

/**
 * @typedef {object} FilterState
 * @property {string} dateFrom  YYYY-MM-DD or ''.
 * @property {string} dateTo    YYYY-MM-DD or ''.
 * @property {string} category  Category name or '' for all.
 * @property {string} search    Free-text query (case-insensitive).
 */

/**
 * Run any pending storage migrations against the raw state pulled from
 * localStorage. Returns the migrated state and writes back SCHEMA_VERSION.
 *
 * @param {object} raw
 * @returns {object}
 */
export function migrate(raw) {
    const from = Number(raw.schemaVersion || 0);
    let state = raw;

    // Example migration scaffold — currently a no-op because schema is v1.
    // if (from < 2) {
    //     state = { ...state, expenses: state.expenses.map(addNewField) };
    // }

    return { ...state, schemaVersion: SCHEMA_VERSION };
}
