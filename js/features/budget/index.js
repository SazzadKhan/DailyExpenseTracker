// js/features/budget/index.js
// Reactive monthly-budget alert. Subscribes to expenses + settings and
// shows/hides the #budget-alert banner.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { $ } from '../../core/dom.js';
import { formatCurrency, getLocalDateString } from '../../core/format.js';
import { isIncome } from '../expenses/expenses.model.js';

function currentMonth() {
    return getLocalDateString(new Date()).substring(0, 7);
}

export function checkBudgetAlert() {
    const banner = $('#budget-alert');
    const message = $('#alert-message');
    if (!banner || !message) return;

    const { expenses, settings } = store.getState();
    if (!settings?.enableNotifications || !settings?.monthlyBudget) {
        banner.classList.remove('visible');
        return;
    }

    const month = currentMonth();
    const inMonth = expenses.filter(e => (e.date || '').substring(0, 7) === month);
    const monthSum    = inMonth.filter(e => !isIncome(e)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const monthIncome = inMonth.filter(e =>  isIncome(e)).reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const percentage = monthIncome > 0 ? (monthSum / monthIncome) * 100 : (monthSum > 0 ? 100 : 0);
    const currency = settings.currency;

    if (monthIncome > 0 && monthSum > monthIncome) {
        message.textContent = `⚠️ You've exceeded your monthly income by ${formatCurrency(monthSum - monthIncome, currency)}!`;
        banner.classList.remove('warning');
        banner.classList.add('visible');
    } else if (monthIncome > 0 && percentage >= settings.warningThreshold) {
        message.textContent = `⚠️ You've spent ${percentage.toFixed(0)}% of your monthly income. ${formatCurrency(monthIncome - monthSum, currency)} remaining.`;
        banner.classList.add('warning', 'visible');
    } else {
        banner.classList.remove('visible');
    }
}

export function mount() {
    const closeBtn = $('#alert-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            $('#budget-alert')?.classList.remove('visible');
        });
    }

    checkBudgetAlert();

    store.subscribe(EVENTS.EXPENSES_CHANGED, checkBudgetAlert);
    store.subscribe(EVENTS.SETTINGS_CHANGED, checkBudgetAlert);
}
