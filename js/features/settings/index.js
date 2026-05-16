// js/features/settings/index.js
// Mount entry for the settings feature.

import { mountTheme } from './theme.js';
import { mountCurrency } from './currency.js';
import { mountBudgetForm } from './budget-form.js';

export function mount() {
    mountTheme();
    mountCurrency();
    mountBudgetForm();
}
