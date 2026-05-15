// js/features/charts/index.js
// Mounts the dashboard + analytics charts. Subscribes to store events so
// any expense/category/settings/filters change triggers a redraw.

import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { $ } from '../../core/dom.js';
import {
    renderAllCharts,
    renderDailyChart,
    renderCategoryChart,
    updateAnalyticsInsights
} from './charts.ui.js';

export function mount() {
    // Month-filter selects.
    const dashboardSelect = $('#dashboard-month-select');
    if (dashboardSelect) {
        dashboardSelect.addEventListener('change', () => renderDailyChart());
    }
    const analyticsSelect = $('#analytics-month-select');
    if (analyticsSelect) {
        analyticsSelect.addEventListener('change', () => {
            renderCategoryChart();
            updateAnalyticsInsights();
        });
    }

    // First paint (Chart.js may not be ready yet on early load — guard inside).
    renderAllCharts();

    store.subscribe(EVENTS.EXPENSES_CHANGED,   renderAllCharts);
    store.subscribe(EVENTS.CATEGORIES_CHANGED, renderAllCharts);
    store.subscribe(EVENTS.SETTINGS_CHANGED,   renderAllCharts);
}
