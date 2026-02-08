// ===== Expense Tracker Application with Google Sheets Integration =====

// ========================================
// CONFIGURATION - Set your Google Script URL here
// ========================================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZT8-21_QCOuWISroIXkK9rWkQDjiHKrJ5ATYrYN-SZpMTXpl2bff2bHju0u5KZVNw/exec';
// ========================================

// Check if Google Sheets is configured
const isCloudEnabled = GOOGLE_SCRIPT_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE' && GOOGLE_SCRIPT_URL.length > 0;

// Default categories and subcategories
const defaultCategories = {
    'Food & Dining': { icon: '🍔', subcategories: ['Groceries', 'Restaurants', 'Coffee & Snacks', 'Fast Food', 'Delivery', 'Other'] },
    'Transportation': { icon: '🚗', subcategories: ['Fuel/Gas', 'Public Transit', 'Uber/Lyft', 'Parking', 'Car Maintenance', 'Other'] },
    'Shopping': { icon: '🛍️', subcategories: ['Clothes', 'Electronics', 'Home & Garden', 'Gifts', 'Online Shopping', 'Other'] },
    'Entertainment': { icon: '🎬', subcategories: ['Movies', 'Games', 'Streaming Services', 'Concerts/Events', 'Sports', 'Other'] },
    'Bills & Utilities': { icon: '💡', subcategories: ['Electricity', 'Water', 'Internet', 'Phone', 'Rent/Mortgage', 'Insurance', 'Other'] },
    'Healthcare': { icon: '🏥', subcategories: ['Doctor Visit', 'Medicine', 'Pharmacy', 'Gym/Fitness', 'Dental', 'Other'] },
    'Education': { icon: '📚', subcategories: ['Courses', 'Books', 'Tuition', 'Supplies', 'Subscriptions', 'Other'] },
    'Personal Care': { icon: '💆', subcategories: ['Haircut', 'Skincare', 'Spa/Massage', 'Cosmetics', 'Other'] },
    'Travel': { icon: '✈️', subcategories: ['Flights', 'Hotels', 'Car Rental', 'Activities', 'Food', 'Other'] },
    'Other': { icon: '📋', subcategories: ['Miscellaneous', 'Charity', 'Gifts Given', 'Fees', 'Other'] }
};

// Currency configurations
const currencies = {
    'USD': { symbol: '$', code: 'USD', locale: 'en-US' },
    'EUR': { symbol: '€', code: 'EUR', locale: 'de-DE' },
    'GBP': { symbol: '£', code: 'GBP', locale: 'en-GB' },
    'BDT': { symbol: '৳', code: 'BDT', locale: 'bn-BD' },
    'INR': { symbol: '₹', code: 'INR', locale: 'en-IN' },
    'JPY': { symbol: '¥', code: 'JPY', locale: 'ja-JP' },
    'CAD': { symbol: 'C$', code: 'CAD', locale: 'en-CA' },
    'AUD': { symbol: 'A$', code: 'AUD', locale: 'en-AU' }
};

// Initialize data from localStorage (fallback)
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let categories = JSON.parse(localStorage.getItem('categories')) || JSON.parse(JSON.stringify(defaultCategories));
let settings = JSON.parse(localStorage.getItem('settings')) || {
    currency: 'USD',
    monthlyBudget: 0,
    warningThreshold: 80,
    enableNotifications: true
};

// Sync status
let isSyncing = false;
let lastSyncTime = null;

// Chart instances
let categoryChart = null;
let dailyChart = null;
let monthlyChart = null;

// DOM Elements
const expenseForm = document.getElementById('expense-form');
const expenseDate = document.getElementById('expense-date');
const expenseCategory = document.getElementById('expense-category');
const expenseSubcategory = document.getElementById('expense-subcategory');
const expenseAmount = document.getElementById('expense-amount');
const expenseDescription = document.getElementById('expense-description');
const expenseTbody = document.getElementById('expense-tbody');
const emptyState = document.getElementById('empty-state');
const todayTotal = document.getElementById('today-total');
const monthTotal = document.getElementById('month-total');
const totalEntries = document.getElementById('total-entries');
const filteredTotal = document.getElementById('filtered-total');
const budgetStatus = document.getElementById('budget-status');
const budgetBar = document.getElementById('budget-bar');
const budgetAlert = document.getElementById('budget-alert');
const alertMessage = document.getElementById('alert-message');
const alertClose = document.getElementById('alert-close');
const currencySelect = document.getElementById('currency-select');
const amountCurrency = document.getElementById('amount-currency');
const syncStatus = document.getElementById('sync-status');
const syncBtn = document.getElementById('sync-btn');

// Filter elements
const filterDateFrom = document.getElementById('filter-date-from');
const filterDateTo = document.getElementById('filter-date-to');
const filterCategory = document.getElementById('filter-category');
const filterSearch = document.getElementById('filter-search');
const clearFiltersBtn = document.getElementById('clear-filters');

// Edit Modal elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editId = document.getElementById('edit-id');
const editDate = document.getElementById('edit-date');
const editCategory = document.getElementById('edit-category');
const editSubcategory = document.getElementById('edit-subcategory');
const editAmount = document.getElementById('edit-amount');
const editDescription = document.getElementById('edit-description');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');

// Settings Modal elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const monthlyBudgetInput = document.getElementById('monthly-budget');
const warningThresholdInput = document.getElementById('warning-threshold');
const enableNotificationsInput = document.getElementById('enable-notifications');
const saveBudgetBtn = document.getElementById('save-budget');

// Category management elements
const categoryList = document.getElementById('category-list');
const newCategoryName = document.getElementById('new-category-name');
const newCategoryIcon = document.getElementById('new-category-icon');
const addCategoryBtn = document.getElementById('add-category');
const subcategoryCategory = document.getElementById('subcategory-category');
const subcategoryList = document.getElementById('subcategory-list');
const newSubcategoryName = document.getElementById('new-subcategory-name');
const addSubcategoryBtn = document.getElementById('add-subcategory');

// Action buttons
const exportCsvBtn = document.getElementById('export-csv');
const importCsvBtn = document.getElementById('import-csv');
const importCsvInput = document.getElementById('import-csv-input');
const deleteAllBtn = document.getElementById('delete-all');

// Sort state
let currentSort = { column: 'date', direction: 'desc' };

// ===== Google Sheets API Functions =====
async function fetchFromCloud(action) {
    if (!isCloudEnabled) return null;

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=${action}`);
        const data = await response.json();
        return data.success ? data : null;
    } catch (error) {
        console.error('Cloud fetch error:', error);
        return null;
    }
}

async function postToCloud(action, payload) {
    if (!isCloudEnabled) return null;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, ...payload })
        });

        // With no-cors mode, we can't read the response
        // But the request will still be processed by the server
        return { success: true };
    } catch (error) {
        console.error('Cloud post error:', error);
        return null;
    }
}

async function syncFromCloud() {
    if (!isCloudEnabled || isSyncing) return;

    isSyncing = true;
    updateSyncStatus('syncing');

    try {
        // Fetch expenses
        const expensesData = await fetchFromCloud('getExpenses');
        if (expensesData && expensesData.expenses && expensesData.expenses.length > 0) {
            expenses = expensesData.expenses;
            localStorage.setItem('expenses', JSON.stringify(expenses));
        }

        // Fetch settings
        const settingsData = await fetchFromCloud('getSettings');
        if (settingsData && settingsData.settings && Object.keys(settingsData.settings).length > 0) {
            settings = { ...settings, ...settingsData.settings };
            localStorage.setItem('settings', JSON.stringify(settings));
        } else {
            // Cloud is empty - push current settings to cloud
            postToCloud('saveSettings', { settings });
        }

        // Fetch categories
        const categoriesData = await fetchFromCloud('getCategories');
        if (categoriesData && categoriesData.categories && Object.keys(categoriesData.categories).length > 0) {
            categories = categoriesData.categories;
            localStorage.setItem('categories', JSON.stringify(categories));
        } else {
            // Cloud is empty - push current categories to cloud
            postToCloud('saveCategories', { categories });
        }

        lastSyncTime = new Date();
        updateSyncStatus('synced');

        // Refresh UI
        populateCategoryDropdowns();
        renderExpenses();
        updateStats();
        renderCharts();
        loadSettingsForm();
        renderCategoryList();

    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatus('error');
    }

    isSyncing = false;
}

async function syncToCloud() {
    if (!isCloudEnabled) return;

    updateSyncStatus('syncing');

    try {
        await postToCloud('syncAll', {
            expenses: expenses,
            settings: settings,
            categories: categories
        });

        lastSyncTime = new Date();
        updateSyncStatus('synced');
    } catch (error) {
        console.error('Sync to cloud error:', error);
        updateSyncStatus('error');
    }
}

function updateSyncStatus(status) {
    if (!syncStatus) return;

    syncStatus.className = 'sync-status';

    switch (status) {
        case 'syncing':
            syncStatus.innerHTML = '🔄 Syncing...';
            syncStatus.classList.add('syncing');
            break;
        case 'synced':
            const time = lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'now';
            syncStatus.innerHTML = `☁️ Synced at ${time}`;
            syncStatus.classList.add('synced');
            break;
        case 'error':
            syncStatus.innerHTML = '⚠️ Sync failed';
            syncStatus.classList.add('error');
            break;
        case 'offline':
            syncStatus.innerHTML = '📴 Offline mode';
            syncStatus.classList.add('offline');
            break;
        default:
            syncStatus.innerHTML = '';
    }
}

// ===== Initialization =====
async function init() {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    expenseDate.value = today;

    // Initialize currency
    currencySelect.value = settings.currency;
    updateCurrencyDisplay();

    // Populate category dropdowns
    populateCategoryDropdowns();

    // Set up event listeners
    setupEventListeners();

    // Load settings into form
    loadSettingsForm();

    // Render initial data from localStorage
    renderExpenses();
    updateStats();
    renderCharts();
    renderCategoryList();

    // Sync from cloud if enabled
    if (isCloudEnabled) {
        await syncFromCloud();
    } else {
        updateSyncStatus('offline');
    }
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Form submission
    expenseForm.addEventListener('submit', handleAddExpense);

    // Category change - update subcategories
    expenseCategory.addEventListener('change', () => {
        updateSubcategories(expenseCategory.value, expenseSubcategory);
    });

    editCategory.addEventListener('change', () => {
        updateSubcategories(editCategory.value, editSubcategory);
    });

    // Currency change
    currencySelect.addEventListener('change', handleCurrencyChange);

    // Filter changes
    filterDateFrom.addEventListener('change', renderExpenses);
    filterDateTo.addEventListener('change', renderExpenses);
    filterCategory.addEventListener('change', renderExpenses);
    filterSearch.addEventListener('input', debounce(renderExpenses, 300));
    clearFiltersBtn.addEventListener('click', clearFilters);

    // Sorting
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.sort));
    });

    // Edit Modal
    modalClose.addEventListener('click', closeEditModal);
    modalCancel.addEventListener('click', closeEditModal);
    editForm.addEventListener('submit', handleEditExpense);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    // Settings Modal
    settingsBtn.addEventListener('click', openSettingsModal);
    settingsClose.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettingsModal();
    });

    // Settings Tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
    });

    // Save Budget
    saveBudgetBtn.addEventListener('click', saveBudgetSettings);

    // Category Management
    addCategoryBtn.addEventListener('click', addNewCategory);
    subcategoryCategory.addEventListener('change', renderSubcategoryList);
    addSubcategoryBtn.addEventListener('click', addNewSubcategory);

    // Alert close
    alertClose.addEventListener('click', () => {
        budgetAlert.classList.remove('visible');
    });

    // Chart tabs
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => switchChartTab(tab.dataset.chart));
    });

    // Export and Delete All
    exportCsvBtn.addEventListener('click', exportToCSV);
    deleteAllBtn.addEventListener('click', handleDeleteAll);

    // Import CSV
    importCsvBtn.addEventListener('click', () => importCsvInput.click());
    importCsvInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importFromCSV(e.target.files[0]);
            e.target.value = ''; // Reset input for re-upload
        }
    });

    // Sync button
    if (syncBtn) {
        syncBtn.addEventListener('click', syncFromCloud);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
            closeSettingsModal();
        }
    });

    // Auto-sync every 5 minutes if cloud is enabled
    if (isCloudEnabled) {
        setInterval(syncFromCloud, 5 * 60 * 1000);
    }
}

// ===== Currency Management =====
function handleCurrencyChange() {
    settings.currency = currencySelect.value;
    saveSettings();
    updateCurrencyDisplay();
    renderExpenses();
    updateStats();
    renderCharts();
}

function updateCurrencyDisplay() {
    const currency = currencies[settings.currency];
    amountCurrency.textContent = `(${currency.symbol})`;
    document.querySelectorAll('.edit-currency').forEach(el => {
        el.textContent = `(${currency.symbol})`;
    });
}

function formatCurrency(amount) {
    const currency = currencies[settings.currency];
    try {
        return new Intl.NumberFormat(currency.locale, {
            style: 'currency',
            currency: currency.code
        }).format(amount);
    } catch (e) {
        return `${currency.symbol}${amount.toFixed(2)}`;
    }
}

// ===== Category Management =====
function populateCategoryDropdowns() {
    const dropdowns = [expenseCategory, editCategory, filterCategory, subcategoryCategory];

    dropdowns.forEach((dropdown, index) => {
        dropdown.innerHTML = index === 2
            ? '<option value="">All Categories</option>'
            : '<option value="">Select Category</option>';

        Object.entries(categories).forEach(([name, data]) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${data.icon} ${name}`;
            dropdown.appendChild(option);
        });
    });
}

function updateSubcategories(category, selectElement) {
    selectElement.innerHTML = '<option value="">Select Subcategory</option>';

    if (category && categories[category]) {
        categories[category].subcategories.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = sub;
            selectElement.appendChild(option);
        });
    }
}

function renderCategoryList() {
    categoryList.innerHTML = '';
    const defaultCategoryNames = Object.keys(defaultCategories);

    Object.entries(categories).forEach(([name, data]) => {
        const isDefault = defaultCategoryNames.includes(name);
        const item = document.createElement('div');
        item.className = `category-item ${isDefault ? 'default' : ''}`;
        item.innerHTML = `
            <span>${data.icon} ${name}</span>
            <button class="btn-delete-category" ${isDefault ? 'disabled title="Cannot delete default category"' : ''} onclick="deleteCategory('${name}')">🗑️</button>
        `;
        categoryList.appendChild(item);
    });

    renderSubcategoryList();
}

function renderSubcategoryList() {
    subcategoryList.innerHTML = '';
    const selectedCategory = subcategoryCategory.value;

    if (!selectedCategory || !categories[selectedCategory]) return;

    const defaultSubs = defaultCategories[selectedCategory]?.subcategories || [];

    categories[selectedCategory].subcategories.forEach(sub => {
        const isDefault = defaultSubs.includes(sub);
        const item = document.createElement('div');
        item.className = 'subcategory-item';
        item.innerHTML = `
            <span>${sub}</span>
            <button class="btn-delete-category" ${isDefault ? 'disabled' : ''} onclick="deleteSubcategory('${selectedCategory}', '${sub}')">🗑️</button>
        `;
        subcategoryList.appendChild(item);
    });
}

async function addNewCategory() {
    const name = newCategoryName.value.trim();
    const icon = newCategoryIcon.value.trim() || '📁';

    if (!name) {
        alert('Please enter a category name');
        return;
    }

    if (categories[name]) {
        alert('Category already exists');
        return;
    }

    categories[name] = {
        icon: icon,
        subcategories: ['Other']
    };

    saveCategories();
    populateCategoryDropdowns();
    renderCategoryList();

    newCategoryName.value = '';
    newCategoryIcon.value = '';
}

async function deleteCategory(name) {
    if (Object.keys(defaultCategories).includes(name)) {
        alert('Cannot delete default categories');
        return;
    }

    if (confirm(`Delete category "${name}"? Expenses in this category will keep their category label.`)) {
        delete categories[name];
        saveCategories();
        populateCategoryDropdowns();
        renderCategoryList();
    }
}

async function addNewSubcategory() {
    const category = subcategoryCategory.value;
    const name = newSubcategoryName.value.trim();

    if (!category) {
        alert('Please select a category first');
        return;
    }

    if (!name) {
        alert('Please enter a subcategory name');
        return;
    }

    if (categories[category].subcategories.includes(name)) {
        alert('Subcategory already exists');
        return;
    }

    categories[category].subcategories.push(name);
    saveCategories();
    renderSubcategoryList();
    populateCategoryDropdowns();

    newSubcategoryName.value = '';
}

async function deleteSubcategory(category, subcategory) {
    const index = categories[category].subcategories.indexOf(subcategory);
    if (index > -1) {
        categories[category].subcategories.splice(index, 1);
        saveCategories();
        renderSubcategoryList();
    }
}

// ===== Settings Modal =====
function openSettingsModal() {
    loadSettingsForm();
    renderCategoryList();
    settingsModal.classList.add('active');
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.settings-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`${tab}-tab`).classList.remove('hidden');
}

function loadSettingsForm() {
    monthlyBudgetInput.value = settings.monthlyBudget || '';
    warningThresholdInput.value = settings.warningThreshold || 80;
    enableNotificationsInput.checked = settings.enableNotifications !== false;
}

async function saveBudgetSettings() {
    settings.monthlyBudget = parseFloat(monthlyBudgetInput.value) || 0;
    settings.warningThreshold = parseInt(warningThresholdInput.value) || 80;
    settings.enableNotifications = enableNotificationsInput.checked;

    saveSettings();
    updateStats();
    checkBudgetAlert();

    alert('Budget settings saved!');
}

// ===== Budget Alert =====
function checkBudgetAlert() {
    if (!settings.enableNotifications || !settings.monthlyBudget) {
        budgetAlert.classList.remove('visible');
        return;
    }

    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
    const monthSum = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const percentage = (monthSum / settings.monthlyBudget) * 100;

    if (percentage >= 100) {
        alertMessage.textContent = `⚠️ You've exceeded your monthly budget by ${formatCurrency(monthSum - settings.monthlyBudget)}!`;
        budgetAlert.classList.remove('warning');
        budgetAlert.classList.add('visible');
    } else if (percentage >= settings.warningThreshold) {
        alertMessage.textContent = `⚠️ You've used ${percentage.toFixed(0)}% of your monthly budget. ${formatCurrency(settings.monthlyBudget - monthSum)} remaining.`;
        budgetAlert.classList.add('warning', 'visible');
    } else {
        budgetAlert.classList.remove('visible');
    }
}

// ===== Charts =====
function switchChartTab(chart) {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-chart="${chart}"]`).classList.add('active');

    document.querySelectorAll('.chart-wrapper').forEach(w => w.classList.add('hidden'));
    document.getElementById(`${chart}-chart-wrapper`).classList.remove('hidden');
}

function renderCharts() {
    renderCategoryChart();
    renderDailyChart();
    renderMonthlyChart();
}

function renderCategoryChart() {
    const ctx = document.getElementById('category-chart').getContext('2d');

    const categoryTotals = {};
    expenses.forEach(exp => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + parseFloat(exp.amount);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = generateColors(labels.length);

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#1e293b',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8', font: { size: 12 }, padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderDailyChart() {
    const ctx = document.getElementById('daily-chart').getContext('2d');

    const days = [];
    const dailyTotals = {};

    for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        days.push(dateStr);
        dailyTotals[dateStr] = 0;
    }

    expenses.forEach(exp => {
        if (dailyTotals.hasOwnProperty(exp.date)) {
            dailyTotals[exp.date] += parseFloat(exp.amount);
        }
    });

    const labels = days.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = days.map(d => dailyTotals[d]);

    if (dailyChart) dailyChart.destroy();

    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Spending',
                data: data,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: '#6366f1',
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatCurrency(context.raw) } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: { ticks: { color: '#94a3b8', callback: (value) => formatCurrency(value) }, grid: { color: '#334155' } }
            }
        }
    });
}

function renderMonthlyChart() {
    const ctx = document.getElementById('monthly-chart').getContext('2d');

    const months = [];
    const monthlyTotals = {};

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().substring(0, 7);
        months.push(monthStr);
        monthlyTotals[monthStr] = 0;
    }

    expenses.forEach(exp => {
        const expMonth = exp.date.substring(0, 7);
        if (monthlyTotals.hasOwnProperty(expMonth)) {
            monthlyTotals[expMonth] += parseFloat(exp.amount);
        }
    });

    const labels = months.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const data = months.map(m => monthlyTotals[m]);

    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Spending',
                data: data,
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
                tooltip: { callbacks: { label: (context) => formatCurrency(context.raw) } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: { ticks: { color: '#94a3b8', callback: (value) => formatCurrency(value) }, grid: { color: '#334155' } }
            }
        }
    });
}

function generateColors(count) {
    const baseColors = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
}

// ===== Add Expense =====
async function handleAddExpense(e) {
    e.preventDefault();

    const expense = {
        id: Date.now().toString(),
        date: expenseDate.value,
        category: expenseCategory.value,
        subcategory: expenseSubcategory.value,
        amount: parseFloat(expenseAmount.value),
        description: expenseDescription.value.trim(),
        currency: settings.currency
    };

    expenses.push(expense);
    saveExpenses();

    // Sync to cloud
    if (isCloudEnabled) {
        postToCloud('addExpense', { expense });
    }

    renderExpenses();
    updateStats();
    renderCharts();
    checkBudgetAlert();

    // Reset form
    expenseAmount.value = '';
    expenseDescription.value = '';
    expenseSubcategory.value = '';
    expenseAmount.focus();
}

// ===== Render Expenses =====
function renderExpenses() {
    let filtered = getFilteredExpenses();
    filtered = sortExpenses(filtered);

    expenseTbody.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.classList.add('visible');
        document.querySelector('.expense-table').style.display = 'none';
    } else {
        emptyState.classList.remove('visible');
        document.querySelector('.expense-table').style.display = 'table';

        filtered.forEach(expense => {
            const row = createExpenseRow(expense);
            expenseTbody.appendChild(row);
        });
    }

    const total = filtered.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    filteredTotal.textContent = formatCurrency(total);
}

function createExpenseRow(expense) {
    const tr = document.createElement('tr');
    const categoryData = categories[expense.category] || { icon: '📋' };
    tr.innerHTML = `
        <td>${formatDate(expense.date)}</td>
        <td><span class="category-badge">${categoryData.icon} ${expense.category}</span></td>
        <td class="subcategory-text">${expense.subcategory}</td>
        <td>${formatCurrency(parseFloat(expense.amount))}</td>
        <td class="description-text" title="${expense.description || '-'}">${expense.description || '-'}</td>
        <td class="action-buttons">
            <button class="btn-edit" onclick="openEditModal('${expense.id}')">✏️ Edit</button>
            <button class="btn-delete" onclick="deleteExpense('${expense.id}')">🗑️ Delete</button>
        </td>
    `;
    return tr;
}

// ===== Filtering =====
function getFilteredExpenses() {
    return expenses.filter(expense => {
        if (filterDateFrom.value && expense.date < filterDateFrom.value) return false;
        if (filterDateTo.value && expense.date > filterDateTo.value) return false;
        if (filterCategory.value && expense.category !== filterCategory.value) return false;

        if (filterSearch.value) {
            const search = filterSearch.value.toLowerCase();
            const matchesDescription = expense.description?.toLowerCase().includes(search);
            const matchesCategory = expense.category.toLowerCase().includes(search);
            const matchesSubcategory = expense.subcategory.toLowerCase().includes(search);
            if (!matchesDescription && !matchesCategory && !matchesSubcategory) return false;
        }

        return true;
    });
}

function clearFilters() {
    filterDateFrom.value = '';
    filterDateTo.value = '';
    filterCategory.value = '';
    filterSearch.value = '';
    renderExpenses();
}

// ===== Sorting =====
function handleSort(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.sort === column) {
            th.classList.add(`sorted-${currentSort.direction}`);
        }
    });

    renderExpenses();
}

function sortExpenses(expensesToSort) {
    return [...expensesToSort].sort((a, b) => {
        let valueA = a[currentSort.column];
        let valueB = b[currentSort.column];

        if (currentSort.column === 'amount') {
            valueA = parseFloat(valueA);
            valueB = parseFloat(valueB);
        } else if (currentSort.column === 'date') {
            valueA = new Date(valueA);
            valueB = new Date(valueB);
        } else {
            valueA = valueA?.toLowerCase() || '';
            valueB = valueB?.toLowerCase() || '';
        }

        if (valueA < valueB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

// ===== Edit Expense =====
function openEditModal(id) {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    editId.value = expense.id;
    editDate.value = expense.date;
    editCategory.value = expense.category;
    updateSubcategories(expense.category, editSubcategory);
    editSubcategory.value = expense.subcategory;
    editAmount.value = expense.amount;
    editDescription.value = expense.description || '';

    editModal.classList.add('active');
}

function closeEditModal() {
    editModal.classList.remove('active');
}

async function handleEditExpense(e) {
    e.preventDefault();

    const id = editId.value;
    const index = expenses.findIndex(e => e.id === id);

    if (index !== -1) {
        expenses[index] = {
            id: id,
            date: editDate.value,
            category: editCategory.value,
            subcategory: editSubcategory.value,
            amount: parseFloat(editAmount.value),
            description: editDescription.value.trim(),
            currency: settings.currency
        };

        saveExpenses();

        if (isCloudEnabled) {
            postToCloud('updateExpense', { expense: expenses[index] });
        }

        renderExpenses();
        updateStats();
        renderCharts();
        checkBudgetAlert();
        closeEditModal();
    }
}

// ===== Delete Expense =====
async function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        expenses = expenses.filter(e => e.id !== id);
        saveExpenses();

        if (isCloudEnabled) {
            postToCloud('deleteExpense', { id });
        }

        renderExpenses();
        updateStats();
        renderCharts();
        checkBudgetAlert();
    }
}

async function handleDeleteAll() {
    if (expenses.length === 0) {
        alert('No expenses to delete!');
        return;
    }

    if (confirm('Are you sure you want to delete ALL expenses? This cannot be undone!')) {
        expenses = [];
        saveExpenses();

        if (isCloudEnabled) {
            postToCloud('deleteAllExpenses', {});
        }

        renderExpenses();
        updateStats();
        renderCharts();
        checkBudgetAlert();
    }
}

// ===== Export to CSV =====
function exportToCSV() {
    if (expenses.length === 0) {
        alert('No expenses to export!');
        return;
    }

    const headers = ['Date', 'Category', 'Subcategory', 'Amount', 'Currency', 'Description'];
    const csvContent = [
        headers.join(','),
        ...expenses.map(e => [
            e.date,
            `"${e.category}"`,
            `"${e.subcategory}"`,
            parseFloat(e.amount).toFixed(2),
            e.currency || settings.currency,
            `"${(e.description || '').replace(/"/g, '""')}"`
        ].join(','))
    ].join('\n');

    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const filename = `expenses_${new Date().toISOString().split('T')[0]}.csv`;

    // Create and trigger download
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();

    // Cleanup after a short delay
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }, 100);

    alert(`Exported ${expenses.length} expenses to ${filename}`);
}

// ===== Import from CSV =====
function importFromCSV(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                alert('CSV file is empty or has no data rows.');
                return;
            }

            // Parse header to determine column positions
            const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

            // Find column indices
            const dateIdx = header.findIndex(h => h === 'date');
            const categoryIdx = header.findIndex(h => h === 'category');
            const subcategoryIdx = header.findIndex(h => h === 'subcategory');
            const amountIdx = header.findIndex(h => h === 'amount');
            const descriptionIdx = header.findIndex(h => h === 'description' || h === 'notes');
            const currencyIdx = header.findIndex(h => h === 'currency');

            // Validate required columns
            if (dateIdx === -1 || categoryIdx === -1 || amountIdx === -1) {
                alert('CSV must have at least: Date, Category, and Amount columns.');
                return;
            }

            // Parse data rows
            const newExpenses = [];
            const errors = [];

            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);

                if (values.length < 3) continue; // Skip empty/invalid rows

                const date = values[dateIdx]?.trim();
                const category = values[categoryIdx]?.trim();
                const amount = parseFloat(values[amountIdx]?.trim().replace(/[^0-9.-]/g, ''));
                const subcategory = subcategoryIdx !== -1 ? values[subcategoryIdx]?.trim() : 'Other';
                const description = descriptionIdx !== -1 ? values[descriptionIdx]?.trim() : '';
                const currency = currencyIdx !== -1 ? values[currencyIdx]?.trim() : settings.currency;

                // Validate row
                if (!date || !category || isNaN(amount)) {
                    errors.push(`Row ${i + 1}: Invalid data`);
                    continue;
                }

                // Validate date format (try to parse it)
                const parsedDate = new Date(date);
                if (isNaN(parsedDate.getTime())) {
                    errors.push(`Row ${i + 1}: Invalid date format`);
                    continue;
                }

                const formattedDate = parsedDate.toISOString().split('T')[0];

                newExpenses.push({
                    id: Date.now().toString() + '_' + i,
                    date: formattedDate,
                    category: category,
                    subcategory: subcategory || 'Other',
                    amount: amount,
                    description: description,
                    currency: currency
                });
            }

            if (newExpenses.length === 0) {
                alert('No valid expenses found in CSV file.\n\nErrors:\n' + errors.slice(0, 5).join('\n'));
                return;
            }

            // Ask user what to do
            const action = confirm(
                `Found ${newExpenses.length} expenses to import.\n\n` +
                (errors.length > 0 ? `${errors.length} rows had errors.\n\n` : '') +
                `Click OK to ADD to existing expenses.\n` +
                `Click Cancel to REPLACE all existing expenses.`
            );

            if (action) {
                // Add to existing
                expenses = [...expenses, ...newExpenses];
            } else {
                // Replace all
                if (confirm('This will DELETE all existing expenses and replace with imported data. Continue?')) {
                    expenses = newExpenses;
                } else {
                    return;
                }
            }

            saveExpenses();

            if (isCloudEnabled) {
                syncToCloud();
            }

            renderExpenses();
            updateStats();
            renderCharts();
            checkBudgetAlert();

            alert(`Successfully imported ${newExpenses.length} expenses!`);

        } catch (error) {
            console.error('CSV import error:', error);
            alert('Failed to parse CSV file. Please check the format.');
        }
    };

    reader.readAsText(file);
}

// Helper function to parse CSV line (handles quoted values)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current); // Add last value
    return result.map(v => v.replace(/^"|"$/g, '').trim());
}

// ===== Statistics =====
function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    const todayExpenses = expenses.filter(e => e.date === today);
    const todaySum = todayExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    todayTotal.textContent = formatCurrency(todaySum);

    const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
    const monthSum = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    monthTotal.textContent = formatCurrency(monthSum);

    totalEntries.textContent = expenses.length;

    if (settings.monthlyBudget > 0) {
        const percentage = (monthSum / settings.monthlyBudget) * 100;
        const remaining = settings.monthlyBudget - monthSum;

        budgetStatus.textContent = remaining >= 0
            ? formatCurrency(remaining) + ' left'
            : formatCurrency(Math.abs(remaining)) + ' over';

        budgetBar.style.width = Math.min(percentage, 100) + '%';
        budgetBar.classList.remove('warning', 'danger');

        if (percentage >= 100) {
            budgetBar.classList.add('danger');
        } else if (percentage >= settings.warningThreshold) {
            budgetBar.classList.add('warning');
        }
    } else {
        budgetStatus.textContent = 'Not Set';
        budgetBar.style.width = '0%';
    }
}

// ===== Utility Functions =====
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function saveExpenses() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
    if (isCloudEnabled) {
        postToCloud('saveCategories', { categories });
    }
}

function saveSettings() {
    localStorage.setItem('settings', JSON.stringify(settings));
    if (isCloudEnabled) {
        postToCloud('saveSettings', { settings });
    }
}

// Make functions globally available
window.openEditModal = openEditModal;
window.deleteExpense = deleteExpense;
window.deleteCategory = deleteCategory;
window.deleteSubcategory = deleteSubcategory;

// Initialize the app
document.addEventListener('DOMContentLoaded', init);
