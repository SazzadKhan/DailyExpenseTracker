// js/features/expenses/list.js
//
// Owns the History view's table + mobile cards, the filter inputs, the sort
// state, the quick date-range chips, and the row-level delete action.
//
// Reactive: subscribes to EXPENSES_CHANGED / CATEGORIES_CHANGED /
// SETTINGS_CHANGED so any store mutation re-renders automatically.

import { $, $$ } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { log } from '../../core/log.js';
import { dialog } from '../../services/dialog.js';
import {
    formatCurrency as fmtCurrency,
    formatDate as fmtDate,
    getLocalDateString,
    debounce
} from '../../core/format.js';
import { sortBy } from './expenses.model.js';
import { open as openEditModal } from './edit-modal.js';
import { remove as removeExpense } from './actions.js';

const $log = log('list');

let currentSort = { column: 'date', direction: 'desc' };

// ---------- helpers ----------------------------------------------------------

const fc = (n) => fmtCurrency(n, store.getState().settings?.currency || 'USD');

// ---------- filters + sort ---------------------------------------------------

function getFiltered() {
    const expenses = store.getState().expenses || [];
    const from = /** @type {HTMLInputElement|null} */ ($('#filter-date-from'))?.value || '';
    const to = /** @type {HTMLInputElement|null} */ ($('#filter-date-to'))?.value || '';
    const cat = /** @type {HTMLSelectElement|null} */ ($('#filter-category'))?.value || '';
    const search = (/** @type {HTMLInputElement|null} */ ($('#filter-search'))?.value || '').toLowerCase();

    return expenses.filter(exp => {
        if (from && exp.date < from) return false;
        if (to && exp.date > to) return false;
        if (cat && exp.category !== cat) return false;
        if (search) {
            const inDesc = exp.description?.toLowerCase().includes(search);
            const inCat = exp.category.toLowerCase().includes(search);
            const inSub = exp.subcategory.toLowerCase().includes(search);
            if (!inDesc && !inCat && !inSub) return false;
        }
        return true;
    });
}

function handleSort(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    $$('.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (/** @type {HTMLElement} */ (th).dataset.sort === column) {
            th.classList.add(`sorted-${currentSort.direction}`);
        }
    });
    render();
}

// ---------- rows + cards -----------------------------------------------------

function rowFor(expense) {
    const tr = document.createElement('tr');
    const categories = store.getState().categories || {};
    const categoryData = categories[expense.category] || { icon: '📋' };
    const income = expense.type === 'income' || expense.category === 'Income';
    const amountVal = parseFloat(expense.amount);
    const amountDisplay = income ? `+ ${fc(amountVal)}` : `- ${fc(amountVal)}`;
    const amountClass = income ? 'income-amount' : 'expense-amount';

    tr.innerHTML = `
        <td>${fmtDate(expense.date)}</td>
        <td><span class="category-badge" data-category="${expense.category}">${categoryData.icon} ${expense.category}</span></td>
        <td class="subcategory-text">${expense.subcategory}</td>
        <td class="${amountClass}">${amountDisplay}</td>
        <td class="description-text" title="${expense.description || '-'}">${expense.description || '-'}</td>
        <td class="action-buttons">
            <button class="btn-edit">✏️ Edit</button>
            <button class="btn-delete">🗑️ Delete</button>
        </td>
    `;
    tr.querySelector('.btn-edit')?.addEventListener('click', () => {
        openEditModal(expense.id);
    });
    tr.querySelector('.btn-delete')?.addEventListener('click', () => deleteExpense(expense.id));
    return tr;
}

function cardFor(expense) {
    const card = document.createElement('div');
    card.className = 'expense-card';
    card.dataset.id = expense.id;
    const categories = store.getState().categories || {};
    const categoryData = categories[expense.category] || { icon: '📋' };
    const income = expense.type === 'income' || expense.category === 'Income';
    const amountVal = parseFloat(expense.amount);
    const amountDisplay = income ? `+ ${fc(amountVal)}` : `- ${fc(amountVal)}`;
    const amountClass = income ? 'income-amount' : 'expense-amount';

    card.innerHTML = `
        <div class="expense-card-main" data-category="${expense.category}">
            <div class="expense-card-left">
                <span class="expense-card-icon">${categoryData.icon}</span>
            </div>
            <div class="expense-card-center">
                <span class="expense-card-title">${expense.subcategory}</span>
                <span class="expense-card-meta">${fmtDate(expense.date)}${expense.description ? ' · ' + expense.description : ''}</span>
            </div>
            <span class="expense-card-amount ${amountClass}">${amountDisplay}</span>
        </div>
        <div class="expense-card-actions">
            <button class="btn-card-edit">✏️ Edit</button>
            <button class="btn-card-delete">🗑️ Delete</button>
        </div>
    `;
    card.querySelector('.btn-card-edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(expense.id);
    });
    card.querySelector('.btn-card-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteExpense(expense.id);
    });
    card.addEventListener('click', () => {
        const wasActive = card.classList.contains('active');
        $$('.expense-card.active').forEach(c => c.classList.remove('active'));
        if (!wasActive) card.classList.add('active');
    });
    return card;
}

// ---------- render -----------------------------------------------------------

function render() {
    const tbody = $('#expense-tbody');
    const emptyState = $('#empty-state');
    const table = $('.expense-table');
    const cardsContainer = $('#expense-cards');
    const filteredTotal = $('#filtered-total');
    if (!tbody || !emptyState || !table) return;

    let filtered = getFiltered();
    filtered = sortBy(filtered, currentSort.column, currentSort.direction);

    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.classList.add('visible');
        table.classList.add('table-empty');
        cardsContainer?.classList.add('table-empty');
    } else {
        emptyState.classList.remove('visible');
        table.classList.remove('table-empty');
        cardsContainer?.classList.remove('table-empty');
        filtered.forEach(exp => {
            tbody.appendChild(rowFor(exp));
            if (cardsContainer) cardsContainer.appendChild(cardFor(exp));
        });
    }

    const total = filtered.reduce((sum, exp) => {
        const income = exp.type === 'income' || exp.category === 'Income';
        return income ? sum + parseFloat(exp.amount) : sum - parseFloat(exp.amount);
    }, 0);
    if (filteredTotal) filteredTotal.textContent = fc(total);
}

// ---------- delete -----------------------------------------------------------

async function deleteExpense(id) {
    const ok = await dialog.confirm({
        title: 'Delete this entry?',
        message: 'This can’t be undone.',
        confirmText: 'Delete',
        tone: 'danger'
    });
    if (!ok) return;
    removeExpense(id);
}

// ---------- quick filters + clear -------------------------------------------

function applyQuickRange(range) {
    const today = new Date();
    let from = '';
    let to = getLocalDateString(today);

    if (range === 'today') {
        from = to;
    } else if (range === '7d') {
        const d = new Date(today); d.setDate(d.getDate() - 6);
        from = getLocalDateString(d);
    } else if (range === '30d') {
        const d = new Date(today); d.setDate(d.getDate() - 29);
        from = getLocalDateString(d);
    } else if (range === 'month') {
        const d = new Date(today.getFullYear(), today.getMonth(), 1);
        from = getLocalDateString(d);
    } else { // 'all'
        from = '';
        to = '';
    }
    const fromEl = /** @type {HTMLInputElement|null} */ ($('#filter-date-from'));
    const toEl = /** @type {HTMLInputElement|null} */ ($('#filter-date-to'));
    if (fromEl) fromEl.value = from;
    if (toEl) toEl.value = to;
    $$('.quick-filter-chip').forEach(c => {
        c.classList.toggle('active', /** @type {HTMLElement} */ (c).dataset.range === range);
    });
    render();
}

function clearFilters() {
    /** @type {HTMLInputElement|null} */
    const from = $('#filter-date-from');
    /** @type {HTMLInputElement|null} */
    const to = $('#filter-date-to');
    /** @type {HTMLSelectElement|null} */
    const cat = $('#filter-category');
    /** @type {HTMLInputElement|null} */
    const search = $('#filter-search');
    if (from) from.value = '';
    if (to) to.value = '';
    if (cat) cat.value = '';
    if (search) search.value = '';
    $$('.quick-filter-chip.active').forEach(c => c.classList.remove('active'));
    render();
}

// ---------- mount ------------------------------------------------------------

export function mount() {
    const tbody = $('#expense-tbody');
    if (!tbody) {
        $log.warn('expense-tbody not found; list not mounted');
        return;
    }

    // Filter inputs
    $('#filter-date-from')?.addEventListener('change', render);
    $('#filter-date-to')?.addEventListener('change', render);
    $('#filter-category')?.addEventListener('change', render);
    const searchEl = $('#filter-search');
    if (searchEl) searchEl.addEventListener('input', debounce(render, 300));
    $('#clear-filters')?.addEventListener('click', clearFilters);

    // Quick date-range chips
    $$('.quick-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => applyQuickRange(/** @type {HTMLElement} */ (chip).dataset.range || 'all'));
    });

    // Sortable headers
    $$('.sortable').forEach(th => {
        th.addEventListener('click', () => handleSort(/** @type {HTMLElement} */ (th).dataset.sort || 'date'));
    });

    // Reactive re-render on store changes.
    store.subscribe(EVENTS.EXPENSES_CHANGED,   render);
    store.subscribe(EVENTS.CATEGORIES_CHANGED, render);
    store.subscribe(EVENTS.SETTINGS_CHANGED,   render);

    // First paint after hydration.
    render();
}
