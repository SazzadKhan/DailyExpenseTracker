// js/features/charts/charts.ui.js
// Chart.js rendering for the dashboard + analytics pages. Reads expense
// data straight from the store; subscribes are wired in index.js.

import { store } from '../../core/store.js';
import { formatCurrency, getLocalDateString } from '../../core/format.js';
import { $ } from '../../core/dom.js';

/** @type {any} */ let categoryChart = null;
/** @type {any} */ let dailyChart = null;
/** @type {any} */ let monthlyChart = null;

const BASE_COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
];

function generateColors(count) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(BASE_COLORS[i % BASE_COLORS.length]);
    return out;
}

function currentCurrency() {
    return store.getState().settings?.currency || 'USD';
}

/**
 * Populate a `YYYY-MM` month <select> from the current expense list.
 * Preserves the user's selection when possible; otherwise defaults to the
 * most recent month.
 */
export function populateMonthSelector(selectEl) {
    if (!selectEl) return;
    const { expenses } = store.getState();
    const months = new Set();
    expenses.forEach(exp => {
        const m = (exp.date || '').substring(0, 7);
        if (m) months.add(m);
    });

    const sortedMonths = [...months].sort().reverse();
    const currentValue = selectEl.value;

    selectEl.innerHTML = '<option value="all">All Time</option>';
    sortedMonths.forEach(m => {
        const [year, month] = m.split('-');
        const label = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const option = document.createElement('option');
        option.value = m;
        option.textContent = label;
        selectEl.appendChild(option);
    });

    if (currentValue && (currentValue === 'all' || sortedMonths.includes(currentValue))) {
        selectEl.value = currentValue;
    } else if (sortedMonths.length > 0) {
        selectEl.value = sortedMonths[0];
    }
}

export function renderCategoryChart() {
    const canvas = $('#category-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const monthSelect = $('#analytics-month-select');
    if (monthSelect) populateMonthSelector(monthSelect);
    const selectedMonth = monthSelect ? monthSelect.value : 'all';

    const { expenses } = store.getState();
    let filtered = expenses;
    if (selectedMonth !== 'all') {
        filtered = expenses.filter(e => (e.date || '').substring(0, 7) === selectedMonth);
    }

    const categoryTotals = {};
    filtered.forEach(exp => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + (Number(exp.amount) || 0);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = generateColors(labels.length);
    const currency = currentCurrency();

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: '#1e293b',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            layout: { padding: { top: 10, bottom: 10 } },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { size: 12 }, padding: 12, boxWidth: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${formatCurrency(value, currency)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

export function renderDailyChart() {
    const canvas = $('#daily-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const monthSelect = $('#dashboard-month-select');
    if (monthSelect) populateMonthSelector(monthSelect);
    const selectedMonth = monthSelect ? monthSelect.value : 'all';

    const { expenses } = store.getState();
    const days = [];

    if (selectedMonth !== 'all') {
        const [y, m] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = getLocalDateString(today);

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
            if (dateStr > todayStr) break;
            days.push(dateStr);
        }
    } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            days.push(getLocalDateString(d));
        }
    }

    const data = new Array(days.length).fill(0);
    expenses.forEach(exp => {
        const idx = days.indexOf((exp.date || '').substring(0, 10));
        if (idx !== -1) data[idx] += Number(exp.amount) || 0;
    });

    const labels = days.map(d => {
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const currency = currentCurrency();
    if (dailyChart) dailyChart.destroy();

    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Daily Spending',
                data,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: '#6366f1',
                borderWidth: 2,
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatCurrency(context.raw, currency) } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8', callback: (value) => formatCurrency(value, currency) },
                    grid: { color: '#334155' }
                }
            }
        }
    });
}

export function renderMonthlyChart() {
    const canvas = $('#monthly-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    const { expenses } = store.getState();
    const months = [];
    const monthlyTotals = {};
    const today = new Date();
    const currentMonthFirst = new Date(today.getFullYear(), today.getMonth(), 1);

    for (let i = 5; i >= 0; i--) {
        const d = new Date(currentMonthFirst);
        d.setMonth(d.getMonth() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const monthStr = `${year}-${month}`;
        months.push(monthStr);
        monthlyTotals[monthStr] = 0;
    }

    expenses.forEach(exp => {
        const expMonth = (exp.date || '').substring(0, 7);
        if (Object.prototype.hasOwnProperty.call(monthlyTotals, expMonth)) {
            monthlyTotals[expMonth] += Number(exp.amount) || 0;
        }
    });

    const labels = months.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const data = months.map(m => monthlyTotals[m]);
    const currency = currentCurrency();

    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Monthly Spending',
                data,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: '#10b981',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatCurrency(context.raw, currency) } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: {
                    ticks: { color: '#94a3b8', callback: (value) => formatCurrency(value, currency) },
                    grid: { color: '#334155' }
                }
            }
        }
    });
}

export function updateAnalyticsInsights() {
    const monthSelect = $('#analytics-month-select');
    if (!monthSelect) return;
    populateMonthSelector(monthSelect);
    const selectedMonth = monthSelect.value;

    const { expenses, categories } = store.getState();
    const currency = currentCurrency();

    const drainsExpenses = selectedMonth !== 'all'
        ? expenses.filter(e => (e.date || '').substring(0, 7) === selectedMonth)
        : expenses;

    const drainsList = $('#drains-list');
    if (!drainsList) return;

    const drainsExpensesFiltered = drainsExpenses.filter(
        e => e.type !== 'income' && e.category !== 'Income'
    );

    if (drainsExpensesFiltered.length === 0) {
        drainsList.innerHTML = '<div class="drains-empty">No expenses for this period</div>';
        return;
    }

    const subTotals = {};
    drainsExpensesFiltered.forEach(e => {
        const key = `${e.category} › ${e.subcategory}`;
        if (!subTotals[key]) subTotals[key] = { total: 0, count: 0, category: e.category };
        subTotals[key].total += Number(e.amount) || 0;
        subTotals[key].count++;
    });

    const sorted = Object.entries(subTotals)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 3);

    drainsList.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];

    sorted.forEach(([name, data], i) => {
        const catData = categories[data.category] || { icon: '📋' };
        const [catName, subName] = name.split(' › ');
        const item = document.createElement('div');
        item.className = 'drain-item';
        item.innerHTML = `
            <span class="drain-rank">${medals[i]}</span>
            <div class="drain-info">
                <span class="drain-name">${catData.icon} ${subName}</span>
                <span class="drain-meta">${data.count} transaction${data.count > 1 ? 's' : ''} · ${catName}</span>
            </div>
            <span class="drain-amount">${formatCurrency(data.total, currency)}</span>
        `;
        drainsList.appendChild(item);
    });
}

export function renderAllCharts() {
    renderCategoryChart();
    renderDailyChart();
    renderMonthlyChart();
    updateAnalyticsInsights();
}
