// js/features/categories/list.js
// Renders the Settings → Categories tab: grouped cards (Income / Expense)
// with subcategory chips, inline "+ Add subcategory" form, edit + delete.
// Subscribes to CATEGORIES_CHANGED so any store mutation re-renders.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { DEFAULT_CATEGORIES } from '../../core/constants.js';
import { isIncomeCategory } from './categories.model.js';
import * as actions from './actions.js';
import { open as openEditCategoryModal } from './edit-modal.js';
import { dialog } from '../../services/dialog.js';
import { showToast } from '../../core/toast.js';
import { log } from '../../core/log.js';

const $log = log('categories/list');

let host = null;
let boundEvents = false;

function escapeHtmlSafe(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttrSafe(s) {
    return escapeHtmlSafe(s).replace(/"/g, '&quot;');
}
function cssAttrEscape(s) {
    return String(s).replace(/(["\\])/g, '\\$1');
}

function toast(msg, type = 'info') { showToast(msg, type); }

function buildCard(name, data, defaultNames) {
    const isDefault = defaultNames.includes(name);
    const defaultSubs = (DEFAULT_CATEGORIES[name]?.subcategories) || [];
    const card = document.createElement('div');
    card.className = 'cat-card' + (isDefault ? ' is-default' : '');
    card.dataset.category = name;

    const subChips = data.subcategories.map(sub => {
        const isDefSub = defaultSubs.includes(sub);
        return `
            <span class="cat-sub-chip${isDefSub ? ' is-default' : ''}">
                <span class="cat-sub-chip-label">${escapeHtmlSafe(sub)}</span>
                <button type="button" class="cat-sub-chip-x" data-action="del-sub" data-sub="${escapeAttrSafe(sub)}" title="Remove">×</button>
            </span>`;
    }).join('') || `<span class="cat-sub-empty">No subcategories yet</span>`;

    card.innerHTML = `
        <div class="cat-card-head">
            <span class="cat-card-icon">${data.icon || '📁'}</span>
            <span class="cat-card-name">${escapeHtmlSafe(name)}</span>
            ${isDefault ? '<span class="cat-card-badge">Default</span>' : ''}
            <span class="cat-card-actions">
                <button type="button" class="cat-card-btn" data-action="edit-cat" title="Edit name & icon">✏️</button>
                <button type="button" class="cat-card-btn danger" data-action="del-cat" title="Delete category">🗑️</button>
            </span>
        </div>
        <div class="cat-card-subs">${subChips}</div>
        <form class="cat-card-add" data-action="add-sub" novalidate>
            <input type="text" placeholder="+ Add subcategory" maxlength="30" autocomplete="off">
            <button type="submit" class="cat-card-add-btn" title="Add">＋</button>
        </form>
    `;
    return card;
}

function buildGroup(label, icon, entries, defaultNames) {
    const wrap = document.createElement('div');
    wrap.className = 'cat-group';
    wrap.innerHTML = `
        <div class="cat-group-header">
            <span class="cat-group-icon">${icon}</span>
            <span class="cat-group-label">${escapeHtmlSafe(label)}</span>
            <span class="cat-group-count">${entries.length}</span>
        </div>
        <div class="cat-card-grid"></div>
    `;
    const grid = wrap.querySelector('.cat-card-grid');
    entries.forEach(([name, data]) => grid.appendChild(buildCard(name, data, defaultNames)));
    return wrap;
}

function render() {
    if (!host) return;
    const categories = store.getState().categories || {};
    const defaultNames = Object.keys(DEFAULT_CATEGORIES);
    const incomeEntries  = Object.entries(categories).filter(([n]) => isIncomeCategory(n));
    const expenseEntries = Object.entries(categories).filter(([n]) => !isIncomeCategory(n));

    host.innerHTML = '';
    if (incomeEntries.length)  host.appendChild(buildGroup('Income',  '💰', incomeEntries,  defaultNames));
    if (expenseEntries.length) host.appendChild(buildGroup('Expense', '💸', expenseEntries, defaultNames));
    bindDelegation();
}

function bindDelegation() {
    if (!host || boundEvents) return;
    boundEvents = true;

    host.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const card = btn.closest('[data-category]');
        if (!card) return;
        const cat = card.dataset.category;
        const action = btn.dataset.action;

        if (action === 'edit-cat') {
            openEditCategoryModal(cat);
        } else if (action === 'del-cat') {
            const ok = await dialog.confirm({
                title: `Delete “${cat}”?`,
                message: 'Expenses in this category will keep their category label.',
                confirmText: 'Delete',
                tone: 'danger'
            });
            if (!ok) return;
            const r = actions.deleteCategory(cat);
            if (!r.ok) toast(r.error, 'warning');
        } else if (action === 'del-sub') {
            const r = actions.deleteSubcategory(cat, btn.dataset.sub);
            if (!r.ok) toast(r.error, 'warning');
        }
    });

    host.addEventListener('submit', (e) => {
        const form = e.target.closest('form[data-action="add-sub"]');
        if (!form) return;
        e.preventDefault();
        const card = form.closest('[data-category]');
        if (!card) return;
        const input = form.querySelector('input');
        const val = (input?.value || '').trim();
        if (!val) return;
        const r = actions.addSubcategory(card.dataset.category, val);
        if (!r.ok) { toast(r.error, 'warning'); return; }
        if (input) input.value = '';
        toast(`Added "${val}"`, 'success');
        requestAnimationFrame(() => {
            const newCard = host.querySelector(`.cat-card[data-category="${cssAttrEscape(card.dataset.category)}"] .cat-card-add input`);
            newCard?.focus();
        });
    });
}

export function mount() {
    host = document.getElementById('category-list');
    if (!host) return;
    render();
    store.subscribe(EVENTS.CATEGORIES_CHANGED, render);
    $log.info('mounted');
}
