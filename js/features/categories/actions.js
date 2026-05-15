// js/features/categories/actions.js
// Category CRUD orchestration: validate → store update → local persist →
// cloud sync (best-effort) → legacy global sync. Returns the new categories
// object so UI flows can sequence follow-up work.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { saveCategories, saveExpenses } from '../../services/local-store.js';
import { storage } from '../../services/storage.js';
import { pushAllToCloud } from '../sync/index.js';
import { log } from '../../core/log.js';

const $log = log('categories/actions');

function commit(nextCats, nextExpenses) {
    const patch = { categories: nextCats };
    const events = [EVENTS.CATEGORIES_CHANGED];
    if (nextExpenses) {
        patch.expenses = nextExpenses;
        events.push(EVENTS.EXPENSES_CHANGED);
    }
    store.update(patch, ...events);
    saveCategories(nextCats);
    if (nextExpenses) saveExpenses(nextExpenses);
    try { storage.saveCategories(nextCats); }
    catch (err) { $log.warn('cloud saveCategories failed', err); }
    if (nextExpenses && storage.isCloud?.()) {
        // Bulk-migrated expenses need a full push; per-row updateExpense calls
        // would be O(n) round-trips. The user is signed in, so this is fine.
        try { pushAllToCloud(); }
        catch (err) { $log.warn('pushAllToCloud failed', err); }
    }
    return nextCats;
}

/** @returns {{ok:true, categories:object} | {ok:false, error:string}} */
export function addCategory(name, icon = '📁') {
    name = String(name || '').trim();
    if (!name) return { ok: false, error: 'Please enter a category name' };
    const cats = store.getState().categories || {};
    if (cats[name]) return { ok: false, error: 'Category already exists' };
    const next = { ...cats, [name]: { icon, subcategories: ['Other'] } };
    commit(next);
    return { ok: true, categories: next };
}

/** Rename a category and/or change its icon. Migrates expense rows. */
export function renameCategory(oldName, newName, icon) {
    const cats = store.getState().categories || {};
    if (!cats[oldName]) return { ok: false, error: 'Category not found' };
    newName = String(newName || '').trim();
    if (!newName) return { ok: false, error: 'Name required' };
    if (newName !== oldName && cats[newName]) {
        return { ok: false, error: 'That category already exists' };
    }
    const rebuilt = {};
    for (const [k, v] of Object.entries(cats)) {
        const key = k === oldName ? newName : k;
        rebuilt[key] = (k === oldName) ? { ...v, icon: icon ?? v.icon } : v;
    }
    let nextExpenses = null;
    if (newName !== oldName) {
        const expenses = store.getState().expenses || [];
        let migrated = 0;
        nextExpenses = expenses.map(e => {
            if (e.category === oldName) { migrated++; return { ...e, category: newName }; }
            return e;
        });
        if (migrated === 0) nextExpenses = null;
    }
    commit(rebuilt, nextExpenses);
    return { ok: true, categories: rebuilt };
}

export function deleteCategory(name) {
    const cats = store.getState().categories || {};
    if (!cats[name]) return { ok: false, error: 'Category not found' };
    const next = { ...cats };
    delete next[name];
    commit(next);
    return { ok: true, categories: next };
}

export function addSubcategory(category, sub) {
    sub = String(sub || '').trim();
    if (!sub) return { ok: false, error: 'Subcategory name required' };
    const cats = store.getState().categories || {};
    if (!cats[category]) return { ok: false, error: 'Category not found' };
    if (cats[category].subcategories.includes(sub)) {
        return { ok: false, error: 'Subcategory already exists' };
    }
    const next = {
        ...cats,
        [category]: { ...cats[category], subcategories: [...cats[category].subcategories, sub] }
    };
    commit(next);
    return { ok: true, categories: next };
}

export function deleteSubcategory(category, sub) {
    const cats = store.getState().categories || {};
    if (!cats[category]) return { ok: false, error: 'Category not found' };
    const subs = cats[category].subcategories.filter(s => s !== sub);
    if (subs.length === cats[category].subcategories.length) {
        return { ok: false, error: 'Subcategory not found' };
    }
    const next = { ...cats, [category]: { ...cats[category], subcategories: subs } };
    commit(next);
    return { ok: true, categories: next };
}
