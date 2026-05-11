// js/features/expenses/expenses.ui.js
// DOM rendering for the expense feature's read-only views:
//   - header stats (today, month, total entries, income remaining + bar)
//   - "Recent Activity" table + cards on the dashboard
//
// Subscribes to the store; never called manually after a mutation.

import { $ } from '../../core/dom.js';
import { formatCurrency, formatDate } from '../../core/format.js';
import { isIncome, selectRecent, selectStats } from './expenses.model.js';

const els = {};

function cacheEls() {
    Object.assign(els, {
        todayTotal:        $('#today-total'),
        monthTotal:        $('#month-total'),
        totalEntries:      $('#total-entries'),
        budgetStatus:      $('#budget-status'),
        budgetBar:         $('#budget-bar'),
        recentTbody:       $('#recent-expense-tbody'),
        recentCards:       $('#recent-expense-cards'),
        recentEmpty:       $('#recent-empty-state'),
        recentTable:       $('#recent-expense-table')
    });
}

/**
 * Render header stat cards + budget bar.
 * @param {import('../../core/schema.js').AppState} state
 */
export function renderStats(state) {
    if (!els.todayTotal) return;
    const { currency, warningThreshold } = state.settings;
    const s = selectStats(state.expenses);

    els.todayTotal.textContent   = formatCurrency(s.todaySpend, currency);
    els.monthTotal.textContent   = formatCurrency(s.monthExpense, currency);
    els.totalEntries.textContent = String(s.totalEntries);
    els.budgetStatus.textContent = formatCurrency(s.remaining, currency);

    const bar = els.budgetBar;
    if (!bar) return;
    bar.classList.remove('warning', 'danger');

    if (s.monthIncome > 0) {
        const pct = (s.monthExpense / s.monthIncome) * 100;
        bar.style.width = Math.min(pct, 100) + '%';
        if (pct >= 100) bar.classList.add('danger');
        else if (pct >= warningThreshold) bar.classList.add('warning');
    } else {
        bar.style.width = '0%';
        if (s.monthExpense > 0) bar.classList.add('danger');
    }
}

/**
 * Render the dashboard "Recent Activity" table + mobile cards.
 * @param {import('../../core/schema.js').AppState} state
 */
export function renderRecent(state) {
    const tbody = els.recentTbody;
    if (!tbody) return;
    const cards = els.recentCards;
    const { currency } = state.settings;

    tbody.innerHTML = '';
    if (cards) cards.innerHTML = '';

    const recent = selectRecent(state.expenses, 10);

    const isEmpty = recent.length === 0;
    els.recentEmpty?.classList.toggle('visible', isEmpty);
    els.recentTable?.classList.toggle('table-empty', isEmpty);
    cards?.classList.toggle('table-empty', isEmpty);
    if (isEmpty) return;

    for (const exp of recent) {
        tbody.appendChild(buildRow(exp, state.categories, currency));
        if (cards) cards.appendChild(buildCard(exp, state.categories, currency));
    }
}

/**
 * @param {import('../../core/schema.js').Expense} expense
 * @param {import('../../core/schema.js').Categories} categories
 * @param {string} currency
 */
function buildRow(expense, categories, currency) {
    const tr = document.createElement('tr');
    const cat = categories[expense.category] || { icon: '📋' };
    const inc = isIncome(expense);
    const amt = Number(expense.amount) || 0;
    const display = (inc ? '+ ' : '- ') + formatCurrency(amt, currency);
    const cls = inc ? 'income-amount' : 'expense-amount';
    const desc = expense.description || '-';

    tr.innerHTML = `
        <td>${formatDate(expense.date)}</td>
        <td><span class="category-badge" data-category="${escapeAttr(expense.category)}">${cat.icon} ${escapeHtml(expense.category)}</span></td>
        <td class="subcategory-text">${escapeHtml(expense.subcategory)}</td>
        <td class="${cls}">${display}</td>
        <td class="description-text" title="${escapeAttr(desc)}">${escapeHtml(desc)}</td>
        <td class="action-buttons">
            <button class="btn-edit" data-action="edit" data-id="${escapeAttr(expense.id)}" title="Edit">✏️</button>
            <button class="btn-delete" data-action="delete" data-id="${escapeAttr(expense.id)}" title="Delete">🗑️</button>
        </td>`;
    return tr;
}

/**
 * @param {import('../../core/schema.js').Expense} expense
 * @param {import('../../core/schema.js').Categories} categories
 * @param {string} currency
 */
function buildCard(expense, categories, currency) {
    const div = document.createElement('div');
    div.className = 'expense-card';
    div.dataset.id = expense.id;
    const cat = categories[expense.category] || { icon: '📋' };
    const inc = isIncome(expense);
    const amt = Number(expense.amount) || 0;
    const display = (inc ? '+ ' : '- ') + formatCurrency(amt, currency);
    const cls = inc ? 'income-amount' : 'expense-amount';
    const desc = expense.description || '';
    const meta = formatDate(expense.date) + (desc ? ' · ' + escapeHtml(desc) : '');

    div.innerHTML = `
        <div class="expense-card-main" data-category="${escapeAttr(expense.category)}">
            <div class="expense-card-left">
                <span class="expense-card-icon">${cat.icon}</span>
            </div>
            <div class="expense-card-center">
                <span class="expense-card-title">${escapeHtml(expense.subcategory)}</span>
                <span class="expense-card-meta">${meta}</span>
            </div>
            <span class="expense-card-amount ${cls}">${display}</span>
        </div>
        <div class="expense-card-actions">
            <button class="btn-card-edit" data-action="edit" data-id="${escapeAttr(expense.id)}">✏️ Edit</button>
            <button class="btn-card-delete" data-action="delete" data-id="${escapeAttr(expense.id)}">🗑️ Delete</button>
        </div>`;
    return div;
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

/** Cache DOM nodes once after the document is ready. */
export function initDom() { cacheEls(); }
