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
    'Income': { icon: '💰', subcategories: ['Salary', 'Freelance', 'Gift', 'Investment', 'Other'] },
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

// ===== Emoji List =====
const EMOJI_LIST = [
    // Food & Drink
    '🍔', '🍕', '🍜', '🍣', '🍱', '🥗', '🍰', '🧁', '☕', '🍺', '🍷', '🥤', '🍿', '🧇', '🥙', '🌮', '🍛', '🥘', '🍲', '🥞',
    // Transport
    '🚗', '🚕', '🚌', '🚇', '✈️', '🚁', '🛳️', '🚂', '🛵', '🚲', '🚀', '⛵', '🛺', '🚐', '🚓', '🏎️',
    // Shopping & Money
    '🛍️', '💳', '💰', '💵', '💸', '🏷️', '🛒', '👜', '👗', '👟', '👒', '⌚', '💍', '🕶️', '🎒',
    // Home & Bills
    '🏠', '💡', '🔌', '📱', '💻', '🖥️', '📺', '🔧', '🛁', '🛏️', '🪑', '🧹', '🪴', '📦', '🔑', '🏗️',
    // Health & Fitness
    '🏥', '💊', '🩺', '💉', '🏋️', '🧘', '🚴', '⚕️', '🩹', '🦷', '👓', '🧴', '🛁',
    // Education
    '📚', '🎓', '✏️', '📝', '🖊️', '📐', '🧪', '🔬', '🏫', '📖', '🗂️', '📋', '🧑‍💻',
    // Entertainment
    '🎬', '🎮', '🎵', '🎸', '🎤', '🎭', '🎨', '🎪', '🎯', '🎳', '🎲', '♟️', '🎻', '🎹', '📷',
    // Personal Care
    '💆', '💅', '🪥', '🧖', '💄', '🪒', '🧴', '🪞', '👔', '👕',
    // Travel & Places
    '🗺️', '🏖️', '🏕️', '🗼', '🏔️', '🌅', '🏟️', '🌍', '🗽', '🏯', '🎡', '⛺',
    // Nature
    '🌿', '🌸', '🌺', '🍀', '🌻', '🍁', '🐾', '🐶', '🐱', '🌈', '⭐', '🌙', '☀️', '❄️',
    // Work & Office
    '💼', '📊', '📈', '📉', '🗓️', '🖇️', '📌', '📎', '🗃️', '📁', '📂', '🖨️', '📠', '🔐', '🏢',
    // Misc / Symbols
    '🎁', '🎀', '🪙', '⚡', '🔔', '🏆', '🥇', '🎖️', '🛡️', '🔖', '📋', '❓', '💬', '🔄', '♻️'
];

// ===== Emoji Picker Builder =====
function buildEmojiPicker(containerEl, displayBtn, getSelected, setSelected) {
    containerEl.innerHTML = '';
    const currentSelected = getSelected();
    EMOJI_LIST.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-btn' + (emoji === currentSelected ? ' selected' : '');
        btn.textContent = emoji;
        btn.title = emoji;
        btn.addEventListener('click', () => {
            setSelected(emoji);
            displayBtn.textContent = emoji;
            containerEl.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            containerEl.style.display = 'none';
        });
        containerEl.appendChild(btn);
    });
}

function toggleEmojiPicker(containerEl, displayBtn, getSelected, setSelected) {
    if (containerEl.style.display === 'none' || containerEl.style.display === '') {
        buildEmojiPicker(containerEl, displayBtn, getSelected, setSelected);
        containerEl.style.display = 'grid';
    } else {
        containerEl.style.display = 'none';
    }
}

// Close emoji pickers when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.emoji-picker-wrapper') && !e.target.closest('.emoji-picker-grid')) {
        if (newEmojiPickerEl) newEmojiPickerEl.style.display = 'none';
        if (editEmojiPickerEl) editEmojiPickerEl.style.display = 'none';
    }
});

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

// Ensure Income category always exists (backfill for older saves that may not have it)
if (!categories['Income']) {
    categories['Income'] = JSON.parse(JSON.stringify(defaultCategories['Income']));
    localStorage.setItem('categories', JSON.stringify(categories));
}
let settings = JSON.parse(localStorage.getItem('settings')) || {
    currency: 'USD',
    monthlyBudget: 0,
    warningThreshold: 80,
    enableNotifications: true,
    theme: 'dark'
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
const themeSelect = document.getElementById('theme-select');

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
const newCategoryIconBtn = document.getElementById('new-category-icon-btn');
const newEmojiPickerEl = document.getElementById('new-emoji-picker');
const addCategoryBtn = document.getElementById('add-category');
const subcategoryCategory = document.getElementById('subcategory-category');
const subcategoryList = document.getElementById('subcategory-list');
const newSubcategoryName = document.getElementById('new-subcategory-name');
const addSubcategoryBtn = document.getElementById('add-subcategory');
// Edit Category Modal
const editCategoryModal = document.getElementById('edit-category-modal');
const editCategoryClose = document.getElementById('edit-category-close');
const editCategoryCancel = document.getElementById('edit-category-cancel');
const editCategorySave = document.getElementById('edit-category-save');
const editCategoryNameInput = document.getElementById('edit-category-name');
const editCategoryIconBtn = document.getElementById('edit-category-icon-btn');
const editEmojiPickerEl = document.getElementById('edit-emoji-picker');

// Picker state
let selectedNewIcon = '📁';
let selectedEditIcon = '📁';
let currentEditingCategoryName = null;

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
            // Normalize dates to YYYY-MM-DD using local timezone
            // Google Sheets may return dates in different formats (ISO datetime, locale strings, etc.)
            expenses = expensesData.expenses.map(exp => {
                if (exp.date) {
                    exp.date = normalizeDateString(exp.date);
                }
                return exp;
            });
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
            // Backfill Income if the cloud data is missing it, then push back so cloud stays in sync
            if (!categories['Income']) {
                categories['Income'] = JSON.parse(JSON.stringify(defaultCategories['Income']));
                postToCloud('saveCategories', { categories });
            }
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
    // Set today's date as default (using local timezone)
    const today = getLocalDateString(new Date());
    expenseDate.value = today;

    // Initialize currency
    currencySelect.value = settings.currency;
    updateCurrencyDisplay();

    // Apply flag emoji polyfill for Windows
    if (typeof countryFlagEmojiPolyfill !== 'undefined') {
        countryFlagEmojiPolyfill.polyfillCountryFlagEmojis();
    }

    // Initialize theme
    setTheme(settings.theme || 'dark');

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

    // Smart Add-modal picker setup (type filter buttons)
    document.querySelectorAll('.type-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAddTypeFilter = btn.dataset.type;
            buildAddCategoryPicker();
        });
    });

    const addCancelBtn = document.getElementById('add-cancel');
    if (addCancelBtn) {
        addCancelBtn.addEventListener('click', () => {
            document.getElementById('add-modal').classList.remove('active');
        });
    }

    editCategory.addEventListener('change', () => {
        updateSubcategories(editCategory.value, editSubcategory);
    });

    // Currency change
    currencySelect.addEventListener('change', handleCurrencyChange);

    // Theme change
    if (themeSelect) {
        themeSelect.addEventListener('change', handleThemeChange);
    }

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
    

    // Bottom Navigation (Mobile)
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => handleNavigation(item.dataset.page));
        });
    }

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

    // New-category emoji picker toggle
    newCategoryIconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiPicker(newEmojiPickerEl, newCategoryIconBtn,
            () => selectedNewIcon,
            (v) => { selectedNewIcon = v; }
        );
    });

    // Edit-category modal controls
    editCategoryClose.addEventListener('click', closeEditCategoryModal);
    editCategoryCancel.addEventListener('click', closeEditCategoryModal);
    editCategorySave.addEventListener('click', saveEditCategory);
    editCategoryModal.addEventListener('click', (e) => {
        if (e.target === editCategoryModal) closeEditCategoryModal();
    });
    editCategoryIconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiPicker(editEmojiPickerEl, editCategoryIconBtn,
            () => selectedEditIcon,
            (v) => { selectedEditIcon = v; }
        );
    });

    // Alert close
    alertClose.addEventListener('click', () => {
        budgetAlert.classList.remove('visible');
    });

    // Chart tabs logic removed since we separated the charts

    // Dashboard month filter
    const dashboardSelect = document.getElementById('dashboard-month-select');
    if (dashboardSelect) {
        dashboardSelect.addEventListener('change', () => {
            renderDailyChart();
        });
    }

    // Analytics month filter
    const analyticsSelect = document.getElementById('analytics-month-select');
    if (analyticsSelect) {
        analyticsSelect.addEventListener('change', () => {
            renderCategoryChart();
            updateAnalyticsInsights();
        });
    }

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

// ===== Theme Management =====
function setTheme(themeName) {
    if (themeName === 'dark') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', themeName);
    }
    settings.theme = themeName;
    if (themeSelect) {
        themeSelect.value = themeName;
    }
}

function handleThemeChange() {
    const theme = themeSelect.value;
    setTheme(theme);
    saveSettings();
}


    const addModal = document.getElementById('add-modal');
    const addClose = document.getElementById('add-close');
    const headerAddBtn = document.getElementById('header-add-btn');

    if (addClose) {
        addClose.addEventListener('click', () => {
            addModal.classList.remove('active');
        });
    }

    if (addModal) {
        addModal.addEventListener('click', (e) => {
            if (e.target === addModal) addModal.classList.remove('active');
        });
    }

    if (headerAddBtn) {
        headerAddBtn.addEventListener('click', () => {
            openAddModal();
        });
    }

// ===== Mobile Navigation =====
function handleNavigation(page) {
    // Handle special popup pages first
    if (page === 'add') {
        openAddModal();
        return;
    }

    // Update active nav item for regular pages
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
    }

    // Show/hide page sections
    document.querySelectorAll('.nav-page').forEach(section => {
        section.classList.toggle('active', section.dataset.page === page);
    });

    // Scroll to top when switching pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateCurrencyDisplay() {
    const currency = currencies[settings.currency];
    if (amountCurrency) amountCurrency.textContent = currency.symbol;
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
// Income category keys — any category name that represents income
const INCOME_CATEGORY_KEYS = ['Income'];

function isIncomeCategory(name) {
    return INCOME_CATEGORY_KEYS.includes(name);
}

function populateCategoryDropdowns() {
    // expenseCategory is now a hidden input driven by the visual picker — rebuild it instead
    buildAddCategoryPicker();

    const dropdowns = [editCategory, filterCategory, subcategoryCategory];

    dropdowns.forEach((dropdown, index) => {
        const isFilter = index === 1;
        dropdown.innerHTML = isFilter
            ? '<option value="">All Categories</option>'
            : '<option value="">Select Category</option>';

        // Split into Income and Expense groups
        const incomeEntries = Object.entries(categories).filter(([name]) => isIncomeCategory(name));
        const expenseEntries = Object.entries(categories).filter(([name]) => !isIncomeCategory(name));

        // For the add/edit form dropdowns, use optgroups with separators
        if (!isFilter) {
            // ── Income ── group
            if (incomeEntries.length > 0) {
                const incomeGroup = document.createElement('optgroup');
                incomeGroup.label = '── Income ──';
                incomeEntries.forEach(([name, data]) => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = `${data.icon} ${name}`;
                    incomeGroup.appendChild(opt);
                });
                dropdown.appendChild(incomeGroup);
            }

            // ── Expenses ── group
            if (expenseEntries.length > 0) {
                const expenseGroup = document.createElement('optgroup');
                expenseGroup.label = '── Expenses ──';
                expenseEntries.forEach(([name, data]) => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = `${data.icon} ${name}`;
                    expenseGroup.appendChild(opt);
                });
                dropdown.appendChild(expenseGroup);
            }
        } else {
            // For filter dropdown, flat list is fine
            Object.entries(categories).forEach(([name, data]) => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = `${data.icon} ${name}`;
                dropdown.appendChild(option);
            });
        }
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
        const safeName = name.replace(/'/g, "\\'");
        const item = document.createElement('div');
        item.className = `category-item ${isDefault ? 'default' : ''}`;
        item.innerHTML = `
            <span>${data.icon} ${name}</span>
            <div class="item-actions">
                <button class="btn-edit-category" title="Edit icon" ${isDefault ? 'disabled' : ''} onclick="openEditCategoryModal('${safeName}')">✏️</button>
                <button class="btn-delete-category" ${isDefault ? 'disabled title="Cannot delete default category"' : ''} onclick="deleteCategory('${safeName}')">🗑️</button>
            </div>
        `;
        categoryList.appendChild(item);
    });

    renderSubcategoryList();
}

function openEditCategoryModal(name) {
    currentEditingCategoryName = name;
    selectedEditIcon = categories[name]?.icon || '📁';
    editCategoryNameInput.value = name;
    editCategoryIconBtn.textContent = selectedEditIcon;
    editEmojiPickerEl.style.display = 'none';
    editCategoryModal.classList.add('active');
}

function closeEditCategoryModal() {
    editCategoryModal.classList.remove('active');
    currentEditingCategoryName = null;
    editEmojiPickerEl.style.display = 'none';
}

function saveEditCategory() {
    if (!currentEditingCategoryName || !categories[currentEditingCategoryName]) return;
    categories[currentEditingCategoryName].icon = selectedEditIcon;
    saveCategories();
    populateCategoryDropdowns();
    renderCategoryList();
    closeEditCategoryModal();
    showToast('Category icon updated!', 'success');
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
    const icon = selectedNewIcon || '📁';

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
    // Reset picker to default
    selectedNewIcon = '📁';
    newCategoryIconBtn.textContent = '📁';
    newEmojiPickerEl.style.display = 'none';
    showToast(`Category "${name}" added!`, 'success');
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
    // Default to General tab
    switchSettingsTab('general');
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

    showToast('Income settings saved!', 'success');
}

// ===== Toast Notification =====
function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Budget Alert =====
function checkBudgetAlert() {
    if (!settings.enableNotifications || !settings.monthlyBudget) {
        budgetAlert.classList.remove('visible');
        return;
    }

    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthExpenses = expenses.filter(e => e.date.substring(0, 7) === currentMonth && (e.type === 'expense' || (e.type !== 'income' && e.category !== 'Income')));
    const monthSum = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    // Calculate Monthly Income dynamically
    const monthIncomeRecords = expenses.filter(e => e.date.substring(0, 7) === currentMonth && (e.type === 'income' || e.category === 'Income'));
    const monthIncome = monthIncomeRecords.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const percentage = monthIncome > 0 ? (monthSum / monthIncome) * 100 : (monthSum > 0 ? 100 : 0);

    if (monthIncome > 0 && monthSum > monthIncome) {
        alertMessage.textContent = `⚠️ You've exceeded your monthly income by ${formatCurrency(monthSum - monthIncome)}!`;
        budgetAlert.classList.remove('warning');
        budgetAlert.classList.add('visible');
    } else if (monthIncome > 0 && percentage >= settings.warningThreshold) {
        alertMessage.textContent = `⚠️ You've spent ${percentage.toFixed(0)}% of your monthly income. ${formatCurrency(monthIncome - monthSum)} remaining.`;
        budgetAlert.classList.add('warning', 'visible');
    } else {
        budgetAlert.classList.remove('visible');
    }
}

// ===== Charts =====
function switchChartTab(chart) {
    // Deprecated: Charts are now separated into different pages
}


function renderCharts() {
    renderCategoryChart();
    renderDailyChart();
    renderMonthlyChart();
    updateAnalyticsInsights();
}

function populateMonthSelector(selectEl) {
    if (!selectEl) return;
    const months = new Set();
    expenses.forEach(exp => {
        const m = exp.date.substring(0, 7);
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
        selectEl.value = sortedMonths[0]; // current/latest month
    }
}

function renderCategoryChart() {
    const ctx = document.getElementById('category-chart').getContext('2d');
    const monthSelect = document.getElementById('analytics-month-select');
    
    if (monthSelect) populateMonthSelector(monthSelect);
    const selectedMonth = monthSelect ? monthSelect.value : 'all';

    // Filter expenses by selected month
    let filtered = expenses;
    if (selectedMonth !== 'all') {
        filtered = expenses.filter(e => e.date.substring(0, 7) === selectedMonth);
    }

    const categoryTotals = {};
    filtered.forEach(exp => {
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
            cutout: '55%',
            layout: {
                padding: { top: 10, bottom: 10 }
            },
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
    const monthSelect = document.getElementById('dashboard-month-select');
    
    if (monthSelect) populateMonthSelector(monthSelect);
    const selectedMonth = monthSelect ? monthSelect.value : 'all';

    const days = [];

    if (selectedMonth !== 'all') {
        // Show all days in the selected month
        const [y, m] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = getLocalDateString(today);

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
            if (dateStr > todayStr) break; // Don't show future dates
            days.push(dateStr);
        }
    } else {
        // Default: last 14 days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            days.push(getLocalDateString(d));
        }
    }

    // Initialize data array with 0s
    const data = new Array(days.length).fill(0);

    // Sum expenses by matching date string directly
    expenses.forEach(exp => {
        const idx = days.indexOf(exp.date.substring(0, 10));
        if (idx !== -1) {
            data[idx] += parseFloat(exp.amount) || 0;
        }
    });

    const labels = days.map(d => {
        // Manually parse YYYY-MM-DD for display label
        const [y, m, day] = d.split('-').map(Number);
        const date = new Date(y, m - 1, day);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

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
                borderRadius: 6,
                barPercentage: 0.6
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
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8', callback: (value) => formatCurrency(value) },
                    grid: { color: '#334155' }
                }
            }
        }
    });
}

function renderMonthlyChart() {
    const ctx = document.getElementById('monthly-chart').getContext('2d');

    const months = [];
    const monthlyTotals = {};
    const today = new Date();
    // Use the 1st of the current month to avoid "31st" edge cases when subtracting months
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




function updateAnalyticsInsights() {
    const monthSelect = document.getElementById('analytics-month-select');
    if (!monthSelect) return;
    populateMonthSelector(monthSelect);
    const selectedMonth = monthSelect.value;
    
    // Drains use selected month
    let drainsExpenses;
    if (selectedMonth !== 'all') {
        drainsExpenses = expenses.filter(e => e.date.substring(0, 7) === selectedMonth);
    } else {
        drainsExpenses = expenses;
    }


    // --- Top Money Drains ---
    const drainsList = document.getElementById('drains-list');

    const drainsExpensesFiltered = drainsExpenses.filter(e => e.type !== 'income' && e.category !== 'Income');

    if (drainsExpensesFiltered.length === 0) {
        drainsList.innerHTML = '<div class="drains-empty">No expenses for this period</div>';
    } else {
        // Group by subcategory
        const subTotals = {};
        drainsExpensesFiltered.forEach(e => {
            const key = `${e.category} › ${e.subcategory}`;
            if (!subTotals[key]) {
                subTotals[key] = { total: 0, count: 0, category: e.category };
            }
            subTotals[key].total += parseFloat(e.amount);
            subTotals[key].count++;
        });

        const sorted = Object.entries(subTotals)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 3);

        drainsList.innerHTML = '';
        const medals = ['🥇', '🥈', '🥉'];

        sorted.forEach(([name, data], i) => {
            const catData = categories[data.category] || { icon: '📋' };
            const item = document.createElement('div');
            item.className = 'drain-item';
            item.innerHTML = `
                <span class="drain-rank">${medals[i]}</span>
                <div class="drain-info">
                    <span class="drain-name">${catData.icon} ${name.split(' › ')[1]}</span>
                    <span class="drain-meta">${data.count} transaction${data.count > 1 ? 's' : ''} · ${name.split(' › ')[0]}</span>
                </div>
                <span class="drain-amount">${formatCurrency(data.total)}</span>
            `;
            drainsList.appendChild(item);
        });
    }
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

// ===== Smart Add-Modal Picker =====
let currentAddTypeFilter = 'expense'; // 'expense' | 'income' | 'all'

function openAddModal() {
    const addModal = document.getElementById('add-modal');
    if (!addModal) return;

    // Reset form fields
    if (expenseForm) expenseForm.reset();
    expenseCategory.value = '';
    expenseSubcategory.value = '';

    // Default date = today (local)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    expenseDate.value = `${yyyy}-${mm}-${dd}`;

    // Reset selected labels
    const catSel = document.getElementById('picker-category-selected');
    const subSel = document.getElementById('picker-subcategory-selected');
    if (catSel) catSel.textContent = 'Pick one';
    if (subSel) subSel.textContent = 'Pick one';

    // Hide subcategory section until a category is chosen
    const subSection = document.getElementById('subcategory-section');
    if (subSection) subSection.style.display = 'none';
    const subChips = document.getElementById('expense-subcategory-chips');
    if (subChips) subChips.innerHTML = '';

    // Reset type filter to expense by default
    currentAddTypeFilter = 'expense';
    document.querySelectorAll('.type-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === currentAddTypeFilter);
    });

    buildAddCategoryPicker();
    addModal.classList.add('active');

    // Focus amount for fast entry
    setTimeout(() => { if (expenseAmount) expenseAmount.focus(); }, 50);
}

function buildAddCategoryPicker() {
    const grid = document.getElementById('expense-category-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const entries = Object.entries(categories).filter(([name]) => {
        if (currentAddTypeFilter === 'income') return isIncomeCategory(name);
        if (currentAddTypeFilter === 'expense') return !isIncomeCategory(name);
        return true;
    });

    if (entries.length === 0) {
        grid.innerHTML = '<div class="picker-empty">No categories. Add some in Settings → Categories.</div>';
        return;
    }

    entries.forEach(([name, data]) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'category-tile';
        if (isIncomeCategory(name)) tile.classList.add('is-income');
        if (expenseCategory.value === name) tile.classList.add('selected');
        tile.dataset.category = name;
        tile.innerHTML = `
            <span class="tile-icon">${data.icon}</span>
            <span class="tile-name">${name}</span>
        `;
        tile.addEventListener('click', () => selectAddCategory(name));
        grid.appendChild(tile);
    });
}

function selectAddCategory(name) {
    expenseCategory.value = name;

    // Update tile selection visuals
    document.querySelectorAll('#expense-category-grid .category-tile').forEach(t => {
        t.classList.toggle('selected', t.dataset.category === name);
    });

    const data = categories[name];
    const catSel = document.getElementById('picker-category-selected');
    if (catSel && data) catSel.textContent = `${data.icon} ${name}`;

    // Reset subcategory and rebuild chips
    expenseSubcategory.value = '';
    const subSel = document.getElementById('picker-subcategory-selected');
    if (subSel) subSel.textContent = 'Pick one';
    buildAddSubcategoryChips(name);
}

function buildAddSubcategoryChips(category) {
    const wrap = document.getElementById('expense-subcategory-chips');
    const section = document.getElementById('subcategory-section');
    if (!wrap || !section) return;
    wrap.innerHTML = '';

    if (!category || !categories[category]) {
        section.style.display = 'none';
        return;
    }

    const subs = categories[category].subcategories || [];
    if (subs.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    subs.forEach(sub => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = sub;
        chip.dataset.sub = sub;
        chip.addEventListener('click', () => {
            expenseSubcategory.value = sub;
            wrap.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            const subSel = document.getElementById('picker-subcategory-selected');
            if (subSel) subSel.textContent = sub;
        });
        wrap.appendChild(chip);
    });
}

// ===== Add Transaction =====
async function handleAddExpense(e) {
    e.preventDefault();

    // Validate picker selections (hidden inputs aren't enforced by the browser)
    const selectedCategory = expenseCategory.value;
    if (!selectedCategory) {
        showToast('Please pick a category', 'warning');
        return;
    }
    if (!expenseSubcategory.value) {
        showToast('Please pick a subcategory', 'warning');
        return;
    }

    // Derive transaction type from the selected category
    const transactionType = isIncomeCategory(selectedCategory) ? 'income' : 'expense';

    const expense = {
        id: Date.now().toString(),
        type: transactionType,
        date: expenseDate.value,
        category: selectedCategory,
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
    
    // Close modal and notify
    const addModal = document.getElementById('add-modal');
    if (addModal) addModal.classList.remove('active');
    
    // Optional: navigate to history or dashboard if we want, or just show toast
    showToast('Entry logged successfully!', 'success');

}

// ===== Render Expenses =====
function renderExpenses() {
    let filtered = getFilteredExpenses();
    filtered = sortExpenses(filtered);

    expenseTbody.innerHTML = '';

    // Also render mobile cards
    const expenseCardsContainer = document.getElementById('expense-cards');
    if (expenseCardsContainer) {
        expenseCardsContainer.innerHTML = '';
    }

    if (filtered.length === 0) {
        emptyState.classList.add('visible');
        document.querySelector('.expense-table').classList.add('table-empty');
        if (expenseCardsContainer) expenseCardsContainer.classList.add('table-empty');
    } else {
        emptyState.classList.remove('visible');
        document.querySelector('.expense-table').classList.remove('table-empty');
        if (expenseCardsContainer) expenseCardsContainer.classList.remove('table-empty');

        filtered.forEach(expense => {
            // Create table row for desktop
            const row = createExpenseRow(expense);
            expenseTbody.appendChild(row);

            // Create card for mobile
            if (expenseCardsContainer) {
                const card = createExpenseCard(expense);
                expenseCardsContainer.appendChild(card);
            }
        });
    }

    const total = filtered.reduce((sum, exp) => {
        const isIncome = exp.type === 'income' || exp.category === 'Income';
        return isIncome ? sum + parseFloat(exp.amount) : sum - parseFloat(exp.amount);
    }, 0);
    filteredTotal.textContent = formatCurrency(total);

    renderRecentExpenses();
}

function renderRecentExpenses() {
    const recentTbody = document.getElementById('recent-expense-tbody');
    const recentCardsContainer = document.getElementById('recent-expense-cards');
    const recentEmptyState = document.getElementById('recent-empty-state');
    const recentTable = document.getElementById('recent-expense-table');
    
    if (!recentTbody) return;

    recentTbody.innerHTML = '';
    if (recentCardsContainer) recentCardsContainer.innerHTML = '';

    // Sort all expenses by date descending and take top 10
    const sorted = [...expenses].sort((a, b) => {
        const dateA = (a.date || '').substring(0, 10);
        const dateB = (b.date || '').substring(0, 10);
        if (dateA < dateB) return 1;
        if (dateA > dateB) return -1;
        return (b.id || 0) - (a.id || 0); 
    });
    
    const recent10 = sorted.slice(0, 10);

    if (recent10.length === 0) {
        if (recentEmptyState) recentEmptyState.classList.add('visible');
        if (recentTable) recentTable.classList.add('table-empty');
        if (recentCardsContainer) recentCardsContainer.classList.add('table-empty');
    } else {
        if (recentEmptyState) recentEmptyState.classList.remove('visible');
        if (recentTable) recentTable.classList.remove('table-empty');
        if (recentCardsContainer) recentCardsContainer.classList.remove('table-empty');

        recent10.forEach(expense => {
            const row = createExpenseRow(expense);
            recentTbody.appendChild(row);

            if (recentCardsContainer) {
                const card = createExpenseCard(expense);
                recentCardsContainer.appendChild(card);
            }
        });
    }
}

function createExpenseRow(expense) {
    const tr = document.createElement('tr');
    const categoryData = categories[expense.category] || { icon: '📋' };
    const isIncome = expense.type === 'income' || expense.category === 'Income';
    const amountVal = parseFloat(expense.amount);
    const amountDisplay = isIncome ? `+ ${formatCurrency(amountVal)}` : `- ${formatCurrency(amountVal)}`;
    const amountClass = isIncome ? 'income-amount' : 'expense-amount';

    tr.innerHTML = `
        <td>${formatDate(expense.date)}</td>
        <td><span class="category-badge" data-category="${expense.category}">${categoryData.icon} ${expense.category}</span></td>
        <td class="subcategory-text">${expense.subcategory}</td>
        <td class="${amountClass}">${amountDisplay}</td>
        <td class="description-text" title="${expense.description || '-'}">${expense.description || '-'}</td>
        <td class="action-buttons">
            <button class="btn-edit">✏️ Edit</button>
            <button class="btn-delete">🗑️ Delete</button>
        </td>
    `;

    // Use addEventListener to avoid broken onclick when IDs contain special characters
    tr.querySelector('.btn-edit').addEventListener('click', () => openEditModal(expense.id));
    tr.querySelector('.btn-delete').addEventListener('click', () => deleteExpense(expense.id));

    return tr;
}

function createExpenseCard(expense) {
    const card = document.createElement('div');
    card.className = 'expense-card';
    card.dataset.id = expense.id;
    const categoryData = categories[expense.category] || { icon: '📋' };

    const isIncome = expense.type === 'income' || expense.category === 'Income';
    const amountVal = parseFloat(expense.amount);
    const amountDisplay = isIncome ? `+ ${formatCurrency(amountVal)}` : `- ${formatCurrency(amountVal)}`;
    const amountClass = isIncome ? 'income-amount' : 'expense-amount';

    card.innerHTML = `
        <div class="expense-card-main" data-category="${expense.category}">
            <div class="expense-card-left">
                <span class="expense-card-icon">${categoryData.icon}</span>
            </div>
            <div class="expense-card-center">
                <span class="expense-card-title">${expense.subcategory}</span>
                <span class="expense-card-meta">${formatDate(expense.date)}${expense.description ? ' · ' + expense.description : ''}</span>
            </div>
            <span class="expense-card-amount ${amountClass}">${amountDisplay}</span>
        </div>
        <div class="expense-card-actions">
            <button class="btn-card-edit">✏️ Edit</button>
            <button class="btn-card-delete">🗑️ Delete</button>
        </div>
    `;

    // Use addEventListener to avoid broken onclick when IDs contain special characters
    card.querySelector('.btn-card-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(expense.id);
    });
    card.querySelector('.btn-card-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteExpense(expense.id);
    });

    // Tap to select/deselect card
    card.addEventListener('click', () => {
        const wasActive = card.classList.contains('active');
        // Deselect all other cards
        document.querySelectorAll('.expense-card.active').forEach(c => c.classList.remove('active'));
        // Toggle this card
        if (!wasActive) {
            card.classList.add('active');
        }
    });

    return card;
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
            // Compare date strings directly (YYYY-MM-DD sorts lexicographically)
            valueA = (valueA || '').substring(0, 10);
            valueB = (valueB || '').substring(0, 10);
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
    const expense = expenses.find(e => String(e.id) === String(id));
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
    const index = expenses.findIndex(e => String(e.id) === String(id));

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
        expenses = expenses.filter(e => String(e.id) !== String(id));
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
    const csvRows = [headers.join(',')];

    expenses.forEach(e => {
        const row = [
            e.date,
            `"${(e.category || '').replace(/"/g, '""')}"`,
            `"${(e.subcategory || '').replace(/"/g, '""')}"`,
            parseFloat(e.amount).toFixed(2),
            e.currency || settings.currency,
            `"${(e.description || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\r\n');
    const filename = `expenses_${new Date().toISOString().split('T')[0]}.csv`;

    // Use data URI approach for better filename support
    const encodedContent = encodeURIComponent(csvContent);
    const dataUri = 'data:text/csv;charset=utf-8,' + encodedContent;

    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`Exported ${expenses.length} expenses to ${filename}`);
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

                // Validate and normalize date format
                const formattedDate = normalizeDateString(date);
                if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    errors.push(`Row ${i + 1}: Invalid date format`);
                    continue;
                }

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
    // Use local date instead of UTC to correctly match today's expenses
    const today = getLocalDateString(new Date());
    const currentMonth = today.substring(0, 7);

    // Calculate Today's Spending (only expenses)
    const todayExpenses = expenses.filter(e => e.date.substring(0, 10) === today && (e.type === 'expense' || (e.type !== 'income' && e.category !== 'Income')));
    const todaySum = todayExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    todayTotal.textContent = formatCurrency(todaySum);

    // Calculate This Month's Income & Expense
    const monthTransactions = expenses.filter(e => e.date.substring(0, 7) === currentMonth);
    
    let monthIncome = 0;
    let monthExpense = 0;
    
    monthTransactions.forEach(e => {
        const isIncome = e.type === 'income' || e.category === 'Income';
        if (isIncome) {
            monthIncome += parseFloat(e.amount);
        } else {
            monthExpense += parseFloat(e.amount);
        }
    });

    monthTotal.textContent = formatCurrency(monthExpense);

    totalEntries.textContent = expenses.length;

    // Budget -> Income Tracker Refactor
    const remaining = monthIncome - monthExpense;
    
    budgetStatus.textContent = formatCurrency(remaining);
    
    // Only show warning based on Income percentage if monthIncome > 0
    if (monthIncome > 0) {
        const percentage = (monthExpense / monthIncome) * 100;
        budgetBar.style.width = Math.min(percentage, 100) + '%';
        budgetBar.classList.remove('warning', 'danger');

        if (percentage >= 100) {
            budgetBar.classList.add('danger');
        } else if (percentage >= settings.warningThreshold) {
            budgetBar.classList.add('warning');
        }
    } else {
        budgetBar.style.width = '0%';
        budgetBar.classList.remove('warning', 'danger');
        if (monthExpense > 0) budgetBar.classList.add('danger');
    }
}

// ===== Utility Functions =====
function formatDate(dateString) {
    // Manually parse YYYY-MM-DD to avoid UTC interpretation that shifts dates
    const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
        const date = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    // Fallback for non-standard formats
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

// Get local date string in YYYY-MM-DD format (respects user's timezone)
function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Normalize a date string to YYYY-MM-DD format using local timezone
// Handles various formats: YYYY-MM-DD, ISO datetime, locale strings, etc.
function normalizeDateString(dateStr) {
    if (!dateStr) return dateStr;

    // Already in YYYY-MM-DD format — return as-is
    const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return dateStr;

    // Fallback: parse and convert using local timezone
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return getLocalDateString(parsed);
    }

    // Can't parse — return original
    return dateStr;
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
