// ===== Expense Tracker Application with Google Sheets Integration =====
// Cloud sync uses per-user OAuth (see auth.js + sheets-api.js + storage.js).
// When signed out, data lives in localStorage only.

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

// Bridge: modules in js/features/* dispatch CRUD via window.__bridge.actions.*
// which returns the new list. Those modules call this setter so this legacy
// `expenses` global stays in sync until renderExpenses / sortExpenses /
// charts / stats are migrated away from it (Phase A3+).
/** @type {any} */ (window).__setLegacyExpenses = (list) => {
    expenses = Array.isArray(list) ? list : [];
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
// CSV buttons (#export-csv / #import-csv / #import-csv-input) are owned
// by js/features/expenses/csv.js
const deleteAllBtn = document.getElementById('delete-all');

// Sort state
let currentSort = { column: 'date', direction: 'desc' };

// ===== Cloud Sync (delegates to storage adapter — see storage.js) =====
// When signed out, the storage backend is a no-op and only localStorage is used.
// When signed in, every mutation is mirrored to the user's own Google Sheet.

async function pullFromCloud() {
    if (!storage.isCloud() || isSyncing) return;

    isSyncing = true;
    updateSyncStatus('syncing');

    try {
        const data = await storage.pullAll();
        if (data) {
            // Replace unconditionally — if the sheet is empty, the local copy
            // should also be empty. Merging-when-empty caused another account's
            // data to leak between sign-ins.
            const incoming = Array.isArray(data.expenses) ? data.expenses : [];
            expenses = incoming.map(exp => {
                if (exp.date) exp.date = normalizeDateString(exp.date);
                return exp;
            });
            localStorage.setItem('expenses', JSON.stringify(expenses));
            window.__bridge && window.__bridge.notifyExpenses(expenses);

            if (data.settings && Object.keys(data.settings).length > 0) {
                settings = { ...settings, ...data.settings };
                localStorage.setItem('settings', JSON.stringify(settings));
            } else {
                // Sheet has no settings yet — seed it with current defaults.
                storage.saveSettings(settings);
            }
            window.__bridge && window.__bridge.notifySettings(settings);

            if (data.categories && Object.keys(data.categories).length > 0) {
                categories = data.categories;
                if (!categories['Income']) {
                    categories['Income'] = JSON.parse(JSON.stringify(defaultCategories['Income']));
                    storage.saveCategories(categories);
                }
                localStorage.setItem('categories', JSON.stringify(categories));
            } else {
                // Sheet has no categories yet — seed it with current defaults.
                storage.saveCategories(categories);
            }
            window.__bridge && window.__bridge.notifyCategories(categories);
        }

        lastSyncTime = new Date();
        updateSyncStatus('synced');

        // Refresh UI
        populateCategoryDropdowns();
        window.__bridge?.renderExpenses?.();
        updateStats();
        renderCharts();
        loadSettingsForm();
        renderCategoryList();
    } catch (error) {
        console.error('Pull error:', error);
        updateSyncStatus('error');
    }

    isSyncing = false;
}

async function pushAllToCloud() {
    if (!storage.isCloud()) return;
    updateSyncStatus('syncing');
    try {
        await storage.pushAll({ expenses, settings, categories });
        lastSyncTime = new Date();
        updateSyncStatus('synced');
    } catch (error) {
        console.error('Push error:', error);
        updateSyncStatus('error');
    }
}

function updateSyncStatus(status) {
    if (!syncStatus) return;

    syncStatus.className = 'sync-status';
    syncStatus.hidden = false;

    switch (status) {
        case 'syncing':
            syncStatus.innerHTML = '🔄 Syncing…';
            syncStatus.classList.add('syncing');
            break;
        case 'synced':
            const time = lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'now';
            syncStatus.innerHTML = `☁️ Synced ${time}`;
            syncStatus.classList.add('synced');
            break;
        case 'error':
            syncStatus.innerHTML = '⚠️ Sync failed';
            syncStatus.classList.add('error');
            break;
        case 'offline':
            syncStatus.innerHTML = '📴 Local only';
            syncStatus.classList.add('offline');
            break;
        default:
            syncStatus.innerHTML = '';
            syncStatus.hidden = true;
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
    window.__bridge?.renderExpenses?.();
    updateStats();
    renderCharts();
    renderCategoryList();

    // Initialize auth + storage
    await initAuthAndStorage();
}

// ===== Auth + Storage bootstrapping =====
const AUTH_MODE_KEY = 'authMode'; // 'guest' | 'google' | undefined

function getAuthMode() {
    try { return localStorage.getItem(AUTH_MODE_KEY); } catch (_) { return null; }
}
function setAuthMode(mode) {
    try {
        if (mode) localStorage.setItem(AUTH_MODE_KEY, mode);
        else localStorage.removeItem(AUTH_MODE_KEY);
    } catch (_) {}
}

function showLanding() {
    const el = document.getElementById('landing-overlay');
    if (el) el.hidden = false;
    document.body.classList.add('landing-open');
}
function hideLanding() {
    const el = document.getElementById('landing-overlay');
    if (el) el.hidden = true;
    document.body.classList.remove('landing-open');
}

async function initAuthAndStorage() {
    const clientId = window.GOOGLE_OAUTH_CLIENT_ID;
    const configured = await window.auth.init(clientId);

    auth.onChange(renderAuthUi);
    setupAuthUi();
    setupLanding();

    if (!configured) {
        // Cloud not set up — silently treat as guest, no landing.
        setAuthMode('guest');
        renderAuthUi();
        return;
    }

    const mode = getAuthMode();

    if (mode === 'google' && auth.getProfile()) {
        // Returning signed-in user — try silent re-auth.
        const ok = await auth.silentSignIn();
        if (ok) {
            await activateCloudBackend({ initial: true });
            renderAuthUi();
            return;
        }
        // Silent failed → fall through to landing so user can re-auth.
        setAuthMode(null);
    }

    if (mode === 'guest') {
        renderAuthUi();
        return;
    }

    // First visit (or cleared state) — show landing.
    showLanding();
    renderAuthUi();
}

async function activateCloudBackend({ initial = false } = {}) {
    try {
        updateSyncStatus('syncing');

        const profile = auth.getProfile();
        const newEmail = profile ? profile.email : null;
        const lastEmail = (() => {
            try { return localStorage.getItem('lastSignedInEmail'); } catch (_) { return null; }
        })();
        const switchedAccount = !!(newEmail && lastEmail && newEmail !== lastEmail);

        // If a different Google account is signing in on this device, wipe
        // the previous user's cached data so it can't leak into the new
        // account's sheet. The new sheet's contents will be loaded by pullFromCloud below.
        if (switchedAccount) {
            wipeLocalData({ keepSettings: false });
        }

        await storage.useSheets();
        setAuthMode('google');
        if (newEmail) {
            try { localStorage.setItem('lastSignedInEmail', newEmail); } catch (_) {}
        }

        // Migration prompt: only offer to upload local data on the FIRST
        // sign-in for this Google account on this device. After the first
        // pull/push, local data is just a mirror of the sheet, so re-prompting
        // every sign-in is noise.
        const migrationKey = newEmail ? `cloudMigrated:${newEmail}` : null;
        const alreadyMigrated = migrationKey
            ? (() => { try { return localStorage.getItem(migrationKey) === '1'; } catch { return false; } })()
            : false;

        if (initial === false && !switchedAccount && !alreadyMigrated && expenses.length > 0) {
            const wantsMigrate = await dialog.confirm({
                title: 'Upload local data?',
                message:
                    `You have ${expenses.length} local entries. Upload them to your Google Sheet?\n\n` +
                    `Choose "Upload" to push your local data, or "Use sheet" to keep whatever's already in the sheet (local data may be overwritten).`,
                confirmText: 'Upload',
                cancelText: 'Use sheet'
            });
            if (wantsMigrate) {
                await pushAllToCloud();
            }
        }
        await pullFromCloud();

        // Mark this account as initialized so we never re-prompt for migration.
        if (migrationKey) {
            try { localStorage.setItem(migrationKey, '1'); } catch (_) {}
        }
    } catch (e) {
        console.error('[cloud] activation failed', e);
        updateSyncStatus('error');
        storage.useLocal();
    }
}

// Reset all per-user data in localStorage and in-memory state to defaults.
// Does NOT touch Google Drive — only this device.
function wipeLocalData({ keepSettings = false } = {}) {
    expenses = [];
    categories = JSON.parse(JSON.stringify(defaultCategories));
    if (!keepSettings) {
        settings = {
            currency: 'USD',
            monthlyBudget: 0,
            warningThreshold: 80,
            enableNotifications: true,
            theme: 'dark'
        };
    }
    try {
        localStorage.setItem('expenses', JSON.stringify(expenses));
        localStorage.setItem('categories', JSON.stringify(categories));
        if (!keepSettings) localStorage.setItem('settings', JSON.stringify(settings));

        // Drop every cached spreadsheet ID — they belong to specific accounts.
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('expenseSheetId:')) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
    } catch (_) {}

    // Notify modular store of the wipe.
    if (window.__bridge) {
        window.__bridge.notifyExpenses(expenses);
        window.__bridge.notifyCategories(categories);
        if (!keepSettings) window.__bridge.notifySettings(settings);
    }

    // Re-render so the UI reflects the wipe immediately.
    if (typeof populateCategoryDropdowns === 'function') populateCategoryDropdowns();
    window.__bridge?.renderExpenses?.();
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderCharts === 'function') renderCharts();
    if (typeof loadSettingsForm === 'function' && !keepSettings) loadSettingsForm();
    if (typeof renderCategoryList === 'function') renderCategoryList();
}

function setupLanding() {
    const signinBtn = document.getElementById('landing-signin-btn');
    const guestBtn = document.getElementById('landing-guest-btn');

    if (signinBtn) {
        signinBtn.addEventListener('click', async () => {
            if (!auth.isConfigured()) {
                showToast('Google sign-in is not configured for this deployment yet.', 'error');
                return;
            }
            const ok = await auth.signIn();
            if (ok) {
                hideLanding();
                await activateCloudBackend({ initial: false });
                renderAuthUi();
            }
        });
    }
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            setAuthMode('guest');
            hideLanding();
            renderAuthUi();
        });
    }
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Add-modal form submission, stage gating, type-filter buttons,
    // view-toggle buttons, and cancel button are wired by
    // js/features/expenses/add-modal.js mount().

    editCategory.addEventListener('change', () => {
        updateSubcategories(editCategory.value, editSubcategory);
    });

    // Currency change
    currencySelect.addEventListener('change', handleCurrencyChange);

    // Theme change
    if (themeSelect) {
        themeSelect.addEventListener('change', handleThemeChange);
    }

    // Filter inputs, quick-range chips, sortable headers, edit modal
    // (open/close/submit, backdrop, modalClose/modalCancel) are wired by
    // js/features/expenses/list.js and js/features/expenses/edit-modal.js.

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
    if (addCategoryBtn) addCategoryBtn.addEventListener('click', addNewCategory);
    if (subcategoryCategory) subcategoryCategory.addEventListener('change', renderSubcategoryList);
    if (addSubcategoryBtn) addSubcategoryBtn.addEventListener('click', addNewSubcategory);

    // Enter key in the "Add Category" name input
    if (newCategoryName) {
        newCategoryName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addNewCategory(); }
        });
    }

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
    // CSV export + import wiring lives in js/features/expenses/csv.js
    deleteAllBtn.addEventListener('click', handleDeleteAll);

    // Sync button (auth widget handles sign-in/out separately)

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.__bridge?.closeEditModal?.();
            closeSettingsModal();
        }
    });

    // Auto-sync every 5 minutes when signed in
    setInterval(() => {
        if (storage.isCloud()) pullFromCloud();
    }, 5 * 60 * 1000);
}

// ===== Currency Management =====
function handleCurrencyChange() {
    settings.currency = currencySelect.value;
    saveSettings();
    updateCurrencyDisplay();
    // saveSettings notifies SETTINGS_CHANGED → list.js re-renders.
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
            window.__bridge?.openAddModal?.();
        });
    }

    // Delegated edit/delete for the module-rendered "Recent Activity"
    // (js/features/expenses/expenses.ui.js emits [data-action] buttons).
    const recentRoots = [
        document.getElementById('recent-expense-tbody'),
        document.getElementById('recent-expense-cards')
    ].filter(Boolean);
    for (const root of recentRoots) {
        root.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action][data-id]');
            if (btn) {
                const id = btn.dataset.id;
                if (btn.dataset.action === 'edit') window.__bridge?.openEditModal?.(id);
                else if (btn.dataset.action === 'delete') window.__bridge?.deleteExpense?.(id);
                return;
            }
            // Tap-to-expand on mobile cards (matches legacy behavior)
            const card = e.target.closest('.expense-card');
            if (!card || !root.contains(card)) return;
            const wasActive = card.classList.contains('active');
            root.querySelectorAll('.expense-card.active').forEach(c => c.classList.remove('active'));
            if (!wasActive) card.classList.add('active');
        });
    }

// ===== Mobile Navigation =====
function handleNavigation(page) {
    // Handle special popup pages first
    if (page === 'add') {
        window.__bridge?.openAddModal?.();
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
    // Delegate to canonical core helper (see js/core/format.js).
    // Fallback only triggers if the module hasn't loaded yet (very early boot).
    const c = window.__core;
    if (c && c.formatCurrency) return c.formatCurrency(amount, settings.currency);
    const currency = currencies[settings.currency];
    try {
        return new Intl.NumberFormat(currency.locale, {
            style: 'currency', currency: currency.code
        }).format(amount);
    } catch (e) {
        return `${currency.symbol}${Number(amount).toFixed(2)}`;
    }
}

// ===== Category Management =====
// Income category keys — any category name that represents income
const INCOME_CATEGORY_KEYS = ['Income'];

function isIncomeCategory(name) {
    return INCOME_CATEGORY_KEYS.includes(name);
}

function populateCategoryDropdowns() {
    // The Add-modal picker is owned by js/features/expenses/add-modal.js;
    // it also re-renders on CATEGORIES_CHANGED, but call directly here for
    // the legacy paths that mutate the global and don't yet notify.
    window.__bridge?.rebuildAddCategoryPicker?.();

    const dropdowns = [editCategory, filterCategory, subcategoryCategory].filter(Boolean);

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
    if (!categoryList) return;
    const defaultCategoryNames = Object.keys(defaultCategories);

    const incomeEntries  = Object.entries(categories).filter(([n]) => isIncomeCategory(n));
    const expenseEntries = Object.entries(categories).filter(([n]) => !isIncomeCategory(n));

    categoryList.innerHTML = '';
    if (incomeEntries.length) {
        categoryList.appendChild(buildCatGroup('Income',  '💰', incomeEntries,  defaultCategoryNames));
    }
    if (expenseEntries.length) {
        categoryList.appendChild(buildCatGroup('Expense', '💸', expenseEntries, defaultCategoryNames));
    }
    bindCategoryListDelegation();
}

function buildCatGroup(label, icon, entries, defaultNames) {
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
    entries.forEach(([name, data]) => grid.appendChild(buildCatCard(name, data, defaultNames)));
    return wrap;
}

function buildCatCard(name, data, defaultNames) {
    const isDefault = defaultNames.includes(name);
    const defaultSubs = (defaultCategories[name]?.subcategories) || [];
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

function bindCategoryListDelegation() {
    if (!categoryList || categoryList.__fxBound) return;
    categoryList.__fxBound = true;

    categoryList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const card = btn.closest('[data-category]');
        if (!card) return;
        const cat = card.dataset.category;
        const action = btn.dataset.action;
        if (action === 'edit-cat') openEditCategoryModal(cat);
        else if (action === 'del-cat') deleteCategory(cat);
        else if (action === 'del-sub') deleteSubcategory(cat, btn.dataset.sub);
    });

    categoryList.addEventListener('submit', (e) => {
        const form = e.target.closest('form[data-action="add-sub"]');
        if (!form) return;
        e.preventDefault();
        const card = form.closest('[data-category]');
        if (!card) return;
        const input = form.querySelector('input');
        const val = (input?.value || '').trim();
        if (!val) return;
        addSubcategoryInline(card.dataset.category, val);
        if (input) input.value = '';
        // Refocus the same input on the freshly rendered card so user can keep typing.
        requestAnimationFrame(() => {
            const newCard = categoryList.querySelector(`.cat-card[data-category="${cssAttrEscape(card.dataset.category)}"] .cat-card-add input`);
            newCard?.focus();
        });
    });
}

function addSubcategoryInline(category, name) {
    if (!categories[category]) return;
    name = String(name).trim();
    if (!name) return;
    if (categories[category].subcategories.includes(name)) {
        showToast('Subcategory already exists', 'warning');
        return;
    }
    categories[category].subcategories.push(name);
    saveCategories();
    populateCategoryDropdowns();
    renderCategoryList();
    showToast(`Added "${name}"`, 'success');
}

function cssAttrEscape(s) {
    return String(s).replace(/(["\\])/g, '\\$1');
}
function escapeHtmlSafe(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttrSafe(s) {
    return escapeHtmlSafe(s).replace(/"/g, '&quot;');
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
    const oldName = currentEditingCategoryName;
    if (!oldName || !categories[oldName]) return;
    const newName = (editCategoryNameInput?.value || '').trim();
    if (!newName) { showToast('Name required', 'warning'); return; }
    if (newName !== oldName && categories[newName]) {
        showToast('That category already exists', 'warning'); return;
    }
    categories[oldName].icon = selectedEditIcon;
    if (newName !== oldName) {
        // Rebuild to preserve insertion order while renaming the key.
        const rebuilt = {};
        for (const [k, v] of Object.entries(categories)) {
            rebuilt[k === oldName ? newName : k] = v;
        }
        categories = rebuilt;
        // Migrate any existing expenses to the new category name.
        let migrated = 0;
        expenses.forEach(e => { if (e.category === oldName) { e.category = newName; migrated++; } });
        if (migrated > 0) saveExpenses();
    }
    saveCategories();
    populateCategoryDropdowns();
    renderCategoryList();
    // saveExpenses + saveCategories already notify the store → list re-renders.
    updateStats();
    closeEditCategoryModal();
    showToast('Category updated', 'success');
}

function renderSubcategoryList() {
    // Legacy: standalone subcategory list is gone — chips render inline per card.
    if (!subcategoryList || !subcategoryCategory) return;
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
        showToast('Please enter a category name', 'warning');
        return;
    }

    if (categories[name]) {
        showToast('Category already exists', 'warning');
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
    const ok = await dialog.confirm({
        title: `Delete “${name}”?`,
        message: `Expenses in this category will keep their category label.`,
        confirmText: 'Delete',
        tone: 'danger'
    });
    if (!ok) return;
    delete categories[name];
    saveCategories();
    populateCategoryDropdowns();
    renderCategoryList();
}

async function addNewSubcategory() {
    if (!subcategoryCategory || !newSubcategoryName) return;
    const category = subcategoryCategory.value;
    const name = newSubcategoryName.value.trim();

    if (!category) {
        showToast('Please select a category first', 'warning');
        return;
    }

    if (!name) {
        showToast('Please enter a subcategory name', 'warning');
        return;
    }

    if (categories[category].subcategories.includes(name)) {
        showToast('Subcategory already exists', 'warning');
        return;
    }

    categories[category].subcategories.push(name);
    saveCategories();
    renderSubcategoryList();
    populateCategoryDropdowns();

    newSubcategoryName.value = '';
}

async function deleteSubcategory(category, subcategory) {
    if (!categories[category]) return;
    const index = categories[category].subcategories.indexOf(subcategory);
    if (index > -1) {
        categories[category].subcategories.splice(index, 1);
        saveCategories();
        populateCategoryDropdowns();
        renderCategoryList();
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
// The Add Transaction modal (open, stage gating, category/subcategory pickers,
// type-filter, view-toggle, and submit) lives in
// js/features/expenses/add-modal.js. The quickAdd* helpers below stay here
// for now because they mutate the legacy `categories` global; they will move
// in Phase B alongside the rest of category management.

async function quickAddCategoryFromLog() {
    const name = await dialog.prompt({
        title: 'New category',
        message: 'You can change the icon later in Categories.',
        placeholder: 'e.g. Pets',
        confirmText: 'Add',
        tone: 'question'
    });
    if (name == null) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;
    if (categories[trimmed]) { showToast('Category already exists', 'warning'); return; }
    categories[trimmed] = { icon: '📁', subcategories: [] };
    saveCategories();
    populateCategoryDropdowns();
    window.__bridge?.rebuildAddCategoryPicker?.();
    window.__bridge?.selectAddCategory?.(trimmed);
    showToast(`Added “${trimmed}”`, 'success');
}

async function quickAddSubcategoryFromLog(category) {
    if (!category || !categories[category]) return;
    const name = await dialog.prompt({
        title: `New subcategory in “${category}”`,
        placeholder: 'e.g. Coffee',
        confirmText: 'Add',
        tone: 'question'
    });
    if (name == null) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;
    if (categories[category].subcategories.includes(trimmed)) {
        showToast('Subcategory already exists', 'warning');
        return;
    }
    categories[category].subcategories.push(trimmed);
    saveCategories();
    populateCategoryDropdowns();
    window.__bridge?.rebuildAddSubcategoryChips?.(category);
    // Auto-select the new subcategory.
    expenseSubcategory.value = trimmed;
    document.querySelectorAll('#expense-subcategory-chips .chip').forEach(c => {
        c.classList.toggle('selected', c.dataset.sub === trimmed);
    });
    const subSel = document.getElementById('picker-subcategory-selected');
    if (subSel) subSel.textContent = trimmed;
}

// ===== History list, filters, sort, edit modal, delete =====
// All moved to js/features/expenses/list.js + edit-modal.js.
// The dashboard "Recent Activity" stub stays so legacy callers compile.
function renderRecentExpenses() { /* moved: js/features/expenses */ }

async function handleDeleteAll() {
    if (expenses.length === 0) {
        showToast('No expenses to delete', 'warning');
        return;
    }

    // Guest / not signed in — single, clear confirm.
    if (!storage.isCloud()) {
        const ok = await dialog.confirm({
            title: `Delete all ${expenses.length} entries?`,
            message: 'This cannot be undone.',
            confirmText: 'Delete all',
            tone: 'danger'
        });
        if (!ok) return;
        expenses = window.__bridge.actions.setAllExpenses([]);
        window.__bridge?.renderExpenses?.();
        updateStats();
        renderCharts();
        checkBudgetAlert();
        showToast('Local data cleared', 'success');
        return;
    }

    // Signed in — prompt for one of three outcomes via the in-app dialog.
    const choice = await dialog.prompt({
        title: 'Reset data',
        message:
            'Choose what to delete:\n' +
            '  1  Everything (local + your Google Sheet)\n' +
            '  2  This device only (sheet stays; resyncs later)\n' +
            'Leave blank or press Cancel to keep your data.',
        placeholder: '1 or 2',
        confirmText: 'Continue'
    });
    const normalized = (choice || '').trim().toLowerCase();

    if (normalized === '1') {
        const ok = await dialog.confirm({
            title: 'Final confirmation',
            message: 'Delete ALL entries from this device AND your Google Sheet?\n\nThis cannot be undone.',
            confirmText: 'Delete everything',
            tone: 'danger'
        });
        if (!ok) return;
        expenses = window.__bridge.actions.setAllExpenses([]);
        try {
            updateSyncStatus('syncing');
            await storage.deleteAllExpenses();
            updateSyncStatus('synced');
        } catch (e) {
            console.error(e);
            updateSyncStatus('error');
            await dialog.alert({
                title: 'Sheet not cleared',
                message: 'Local data was cleared, but the Google Sheet could not be cleared. Please try again from the Profile page (Pull / Push).',
                tone: 'error'
            });
        }
        window.__bridge?.renderExpenses?.();
        updateStats();
        renderCharts();
        checkBudgetAlert();
        showToast('All data cleared', 'success');
    } else if (normalized === '2') {
        const ok = await dialog.confirm({
            title: 'Clear this device only?',
            message: 'Your Google Sheet stays untouched. Local data will be repopulated from the sheet on next sync.',
            confirmText: 'Clear device',
            tone: 'warn'
        });
        if (!ok) return;
        expenses = window.__bridge.actions.setAllExpenses([]);
        window.__bridge?.renderExpenses?.();
        updateStats();
        renderCharts();
        checkBudgetAlert();
        showToast('Local data cleared (sheet preserved)', 'success');
        // Pull cloud data back so the user isn't left with a confusingly empty UI.
        pullFromCloud();
    }
    // any other input = cancel
}

// ===== CSV =====
// Export, import, and parseCSVLine moved to js/features/expenses/csv.js.

// ===== Statistics =====
// Now owned by js/features/expenses/expenses.ui.js (renderStats).
// This stub stays so legacy callers compile; module subscribes to the store.
function updateStats() { /* moved: js/features/expenses */ }

// ===== Utility Functions =====
// All formatters delegate to js/core/format.js (exposed via window.__core).
// Wrappers stay only until call sites are migrated into ES modules.
function formatDate(dateString) {
    const c = window.__core;
    if (c && c.formatDate) return c.formatDate(dateString);
    const parts = dateString && dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
        const date = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function debounce(func, wait) {
    const c = window.__core;
    if (c && c.debounce) return c.debounce(func, wait);
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Get local date string in YYYY-MM-DD format (respects user's timezone)
function getLocalDateString(date) {
    const c = window.__core;
    if (c && c.getLocalDateString) return c.getLocalDateString(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Normalize a date string to YYYY-MM-DD format using local timezone
function normalizeDateString(dateStr) {
    const c = window.__core;
    if (c && c.normalizeDateString) return c.normalizeDateString(dateStr);
    if (!dateStr) return dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return dateStr;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return getLocalDateString(parsed);
    return dateStr;
}

function saveExpenses() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
    // Notify the new modular store (js/main.js). Safe no-op if not loaded yet.
    window.__bridge && window.__bridge.notifyExpenses(expenses);
}

function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
    storage.saveCategories(categories);
    window.__bridge && window.__bridge.notifyCategories(categories);
}

function saveSettings() {
    localStorage.setItem('settings', JSON.stringify(settings));
    storage.saveSettings(settings);
    window.__bridge && window.__bridge.notifySettings(settings);
}

// Make functions globally available
window.openEditModal = (id) => window.__bridge?.openEditModal?.(id);
window.deleteExpense = (id) => window.__bridge?.deleteExpense?.(id);
window.deleteCategory = deleteCategory;
window.deleteSubcategory = deleteSubcategory;

// ===== Auth widget UI =====
function setupAuthUi() {
    const signinBtn = document.getElementById('signin-btn');
    const profileBtn = document.getElementById('auth-trigger');
    const menu = document.getElementById('auth-menu');
    const signoutBtn = document.getElementById('signout-btn');
    const banner = document.getElementById('signin-banner');
    const bannerSigninBtn = document.getElementById('banner-signin-btn');
    const bannerCloseBtn = document.getElementById('banner-close');
    const profileSigninBtn = document.getElementById('profile-signin-btn');
    const profileSignoutBtn = document.getElementById('profile-signout-btn');
    const profilePullBtn = document.getElementById('profile-pull-btn');
    const profilePushBtn = document.getElementById('profile-push-btn');

    const doSignIn = async () => {
        if (!auth.isConfigured()) {
            await dialog.alert({
                title: 'Sign-in not configured',
                message: 'Google sign-in is not configured for this deployment yet.\n\nSee OAUTH_SETUP.md for instructions.',
                tone: 'error'
            });
            return;
        }
        const ok = await auth.signIn();
        if (ok) {
            await activateCloudBackend({ initial: false });
            renderAuthUi();
        }
    };
    const doSignOut = async () => {
        const confirmed = await dialog.confirm({
            title: 'Sign out of this device?',
            message:
                'Your data stays safe in your Google Sheet on Drive — this only removes the local cached copy so the next person using this browser doesn’t see your data.',
            confirmText: 'Sign out',
            tone: 'warn'
        });
        if (!confirmed) return;

        await auth.signOut();
        storage.useLocal();
        setAuthMode(null);
        try { localStorage.removeItem('lastSignedInEmail'); } catch (_) {}
        wipeLocalData();
        updateSyncStatus('offline');
        renderAuthUi();
        showLanding();
    };

    if (signinBtn) signinBtn.addEventListener('click', doSignIn);
    if (bannerSigninBtn) bannerSigninBtn.addEventListener('click', doSignIn);
    if (profileSigninBtn) profileSigninBtn.addEventListener('click', doSignIn);
    if (signoutBtn) signoutBtn.addEventListener('click', doSignOut);
    if (profileSignoutBtn) profileSignoutBtn.addEventListener('click', doSignOut);

    if (profilePullBtn) profilePullBtn.addEventListener('click', async () => {
        if (!storage.isCloud()) return;
        const ok = await dialog.confirm({
            title: 'Pull from sheet?',
            message: 'Replace local data with the contents of your Google Sheet.',
            confirmText: 'Pull',
            tone: 'warn'
        });
        if (ok) await pullFromCloud();
    });
    if (profilePushBtn) profilePushBtn.addEventListener('click', async () => {
        if (!storage.isCloud()) return;
        const ok = await dialog.confirm({
            title: 'Push to sheet?',
            message: 'Overwrite your Google Sheet with all local data.',
            confirmText: 'Push',
            tone: 'warn'
        });
        if (ok) await pushAllToCloud();
    });

    if (profileBtn && menu) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.hidden = !menu.hidden;
        });
        document.addEventListener('click', (e) => {
            if (!menu.hidden && !menu.contains(e.target) && e.target !== profileBtn) {
                menu.hidden = true;
            }
        });
    }

    if (bannerCloseBtn && banner) {
        bannerCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            banner.hidden = true;
            try { localStorage.setItem('signinBannerDismissed', '1'); } catch (_) {}
        });
    }
}

function renderAuthUi() {
    const signinBtn = document.getElementById('signin-btn');
    const profileEl = document.getElementById('auth-profile');
    const banner = document.getElementById('signin-banner');
    const profile = auth.getProfile();
    const signedIn = auth.isSignedIn();

    // Header widget
    if (signinBtn && profileEl) {
        if (signedIn && profile) {
            signinBtn.hidden = true;
            profileEl.hidden = false;

            const avatar = document.getElementById('auth-avatar');
            const fallback = document.getElementById('auth-avatar-fallback');
            setAvatar(avatar, fallback, profile.picture);
            const nameEl = document.getElementById('auth-name');
            if (nameEl) nameEl.textContent = profile.name || profile.email || '';
            const menuName = document.getElementById('auth-menu-name');
            if (menuName) menuName.textContent = profile.name || '';
            const menuEmail = document.getElementById('auth-menu-email');
            if (menuEmail) menuEmail.textContent = profile.email || '';

            const sheetLink = document.getElementById('open-sheet-link');
            if (sheetLink) {
                const url = window.sheetsApi && window.sheetsApi.getSpreadsheetUrl();
                if (url) {
                    sheetLink.href = url;
                    sheetLink.style.display = '';
                } else {
                    sheetLink.style.display = 'none';
                }
            }
        } else {
            signinBtn.hidden = !auth.isConfigured();
            profileEl.hidden = true;
        }
    }

    // Banner — only show for guest users who haven't dismissed it
    if (banner) {
        const dismissed = (() => {
            try { return localStorage.getItem('signinBannerDismissed') === '1'; } catch (_) { return false; }
        })();
        const isGuest = getAuthMode() === 'guest';
        banner.hidden = signedIn || !auth.isConfigured() || dismissed || !isGuest;
    }

    // Sync status when signed out
    if (!signedIn) updateSyncStatus('offline');

    // Profile page
    const profileSignedOut = document.getElementById('profile-signed-out');
    const profileSignedIn = document.getElementById('profile-signed-in');
    if (profileSignedOut && profileSignedIn) {
        profileSignedOut.hidden = signedIn;
        profileSignedIn.hidden = !signedIn;
        if (signedIn && profile) {
            const pAvatar = document.getElementById('profile-avatar');
            const pFallback = document.getElementById('profile-avatar-fallback');
            setAvatar(pAvatar, pFallback, profile.picture);
            const pName = document.getElementById('profile-name');
            if (pName) pName.textContent = profile.name || '';
            const pEmail = document.getElementById('profile-email');
            if (pEmail) pEmail.textContent = profile.email || '';
            const pSheet = document.getElementById('profile-sheet-link');
            if (pSheet) {
                const url = window.sheetsApi && window.sheetsApi.getSpreadsheetUrl();
                if (url) { pSheet.href = url; pSheet.style.display = ''; }
                else { pSheet.style.display = 'none'; }
            }
        }

        // Stats
        const entriesEl = signedIn
            ? document.getElementById('profile-stat-entries-in')
            : document.getElementById('profile-stat-entries');
        if (entriesEl) entriesEl.textContent = expenses.length;

        const sinceEl = document.getElementById('profile-stat-since');
        if (sinceEl) sinceEl.textContent = oldestExpenseDateLabel();

        const lastSyncEl = document.getElementById('profile-stat-lastsync');
        if (lastSyncEl) lastSyncEl.textContent = lastSyncTime ? lastSyncTime.toLocaleTimeString() : '—';
    }
}

function oldestExpenseDateLabel() {
    if (!expenses.length) return '—';
    const dates = expenses.map(e => (e.date || '').substring(0, 10)).filter(Boolean).sort();
    if (!dates.length) return '—';
    try {
        const d = new Date(dates[0] + 'T00:00:00');
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) {
        return dates[0];
    }
}

function setAvatar(imgEl, fallbackEl, url) {
    if (!imgEl && !fallbackEl) return;
    const showFallback = () => {
        if (imgEl) { imgEl.hidden = true; imgEl.removeAttribute('src'); }
        if (fallbackEl) fallbackEl.hidden = false;
    };
    if (url && imgEl) {
        imgEl.onerror = showFallback;
        imgEl.onload = () => {
            imgEl.hidden = false;
            if (fallbackEl) fallbackEl.hidden = true;
        };
        // Hide until loaded so we don't flash a broken image icon
        imgEl.hidden = true;
        if (fallbackEl) fallbackEl.hidden = false;
        imgEl.src = url;
    } else {
        showFallback();
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);
