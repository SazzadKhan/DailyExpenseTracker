// js/features/expenses/add-modal.js
//
// Phase A2: owns the Add Transaction modal (smart picker + stage gating +
// submit). Reads `categories` and `settings` from the store; dispatches
// CRUD through `window.__bridge.actions.addExpense`.
//
// Legacy helpers still used (via window globals) until later phases move them:
//   window.isIncomeCategory, window.showToast, window.saveCategories,
//   window.populateCategoryDropdowns, window.renderExpenses,
//   window.updateStats, window.renderCharts, window.checkBudgetAlert,
//   window.dialog
//
// Public surface:
//   mount()  — wires DOM listeners, store subscriptions, and exposes
//              window.__bridge.openAddModal for the legacy nav/header buttons.

import { $, $$ } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { log } from '../../core/log.js';

const $log = log('add-modal');

let currentTypeFilter = 'expense';

// ---------- helpers ----------------------------------------------------------

function getCategories() {
    return store.getState().categories || {};
}

function isIncome(name) {
    const fn = /** @type {any} */ (window).isIncomeCategory;
    return typeof fn === 'function' ? fn(name) : false;
}

function toast(msg, kind) {
    const fn = /** @type {any} */ (window).showToast;
    if (typeof fn === 'function') fn(msg, kind);
}

function todayLocalIso() {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, '0');
    const dd = String(t.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ---------- stage machine ----------------------------------------------------

function setStage(stage) {
    const form = $('#expense-form');
    if (!form) return;
    const order = ['category', 'subcategory', 'amount', 'note'];
    if (!order.includes(stage)) stage = 'category';
    /** @type {HTMLElement} */ (form).dataset.stage = stage;
    $$('[data-step]', form).forEach(el => {
        el.classList.toggle('step-active', /** @type {HTMLElement} */ (el).dataset.step === stage);
    });
    const saveBtn = /** @type {HTMLButtonElement|null} */ ($('#btn-add-transaction'));
    if (saveBtn) saveBtn.disabled = stage !== 'note';
}

function refreshStage() {
    const cat = /** @type {HTMLInputElement|null} */ ($('#expense-category'));
    const sub = /** @type {HTMLInputElement|null} */ ($('#expense-subcategory'));
    const amt = /** @type {HTMLInputElement|null} */ ($('#expense-amount'));
    if (!cat || !sub || !amt) return;
    if (!cat.value) return setStage('category');
    if (!sub.value) return setStage('subcategory');
    const n = parseFloat(amt.value);
    if (!Number.isFinite(n) || n <= 0) return setStage('amount');
    setStage('note');
}

// ---------- pickers ----------------------------------------------------------

function buildCategoryPicker() {
    const grid = $('#expense-category-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const savedView = (() => {
        try { return localStorage.getItem('categoryPickerView') || 'grid'; } catch { return 'grid'; }
    })();
    /** @type {HTMLElement} */ (grid).dataset.view = savedView;
    $$('.view-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', /** @type {HTMLElement} */ (btn).dataset.view === savedView);
    });

    const categories = getCategories();
    const currentCat = /** @type {HTMLInputElement|null} */ ($('#expense-category'));
    const entries = Object.entries(categories).filter(([name]) => {
        if (currentTypeFilter === 'income') return isIncome(name);
        if (currentTypeFilter === 'expense') return !isIncome(name);
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
        if (isIncome(name)) tile.classList.add('is-income');
        if (currentCat && currentCat.value === name) tile.classList.add('selected');
        tile.dataset.category = name;
        tile.innerHTML = `
            <span class="tile-icon">${/** @type {any} */ (data).icon}</span>
            <span class="tile-name">${name}</span>
        `;
        tile.addEventListener('click', () => selectCategory(name));
        grid.appendChild(tile);
    });

    const addTile = document.createElement('button');
    addTile.type = 'button';
    addTile.className = 'category-tile category-tile-add';
    addTile.innerHTML = `
        <span class="tile-icon">＋</span>
        <span class="tile-name">New</span>
    `;
    // Quick-add still owned by legacy app.js (it mutates the `categories`
    // global directly + calls saveCategories). Moves in Phase B.
    addTile.addEventListener('click', () => {
        /** @type {any} */ (window).quickAddCategoryFromLog?.();
    });
    grid.appendChild(addTile);
}

function selectCategory(name) {
    const cat = /** @type {HTMLInputElement|null} */ ($('#expense-category'));
    const sub = /** @type {HTMLInputElement|null} */ ($('#expense-subcategory'));
    if (!cat || !sub) return;
    cat.value = name;
    $$('#expense-category-grid .category-tile').forEach(t => {
        t.classList.toggle('selected', /** @type {HTMLElement} */ (t).dataset.category === name);
    });
    const data = getCategories()[name];
    const catSel = $('#picker-category-selected');
    if (catSel && data) catSel.textContent = `${/** @type {any} */ (data).icon} ${name}`;
    sub.value = '';
    const subSel = $('#picker-subcategory-selected');
    if (subSel) subSel.textContent = 'Pick one';
    buildSubcategoryChips(name);
    setStage('subcategory');
}

function buildSubcategoryChips(category) {
    const wrap = $('#expense-subcategory-chips');
    const section = $('#subcategory-section');
    if (!wrap || !section) return;
    wrap.innerHTML = '';
    const categories = getCategories();

    if (!category || !categories[category]) {
        /** @type {HTMLElement} */ (section).style.display = 'none';
        return;
    }

    const subs = categories[category].subcategories || [];
    /** @type {HTMLElement} */ (section).style.display = '';

    subs.forEach(sub => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = sub;
        chip.dataset.sub = sub;
        chip.addEventListener('click', () => {
            const subInput = /** @type {HTMLInputElement|null} */ ($('#expense-subcategory'));
            if (subInput) subInput.value = sub;
            $$('#expense-subcategory-chips .chip', wrap).forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            const subSel = $('#picker-subcategory-selected');
            if (subSel) subSel.textContent = sub;
            setStage('amount');
            const amt = /** @type {HTMLInputElement|null} */ ($('#expense-amount'));
            if (amt) setTimeout(() => amt.focus(), 50);
        });
        wrap.appendChild(chip);
    });

    const addChip = document.createElement('button');
    addChip.type = 'button';
    addChip.className = 'chip chip-add';
    addChip.textContent = '＋ New';
    // Legacy app.js owns this until Phase B.
    addChip.addEventListener('click', () => {
        /** @type {any} */ (window).quickAddSubcategoryFromLog?.(category);
    });
    wrap.appendChild(addChip);
}

// ---------- open + submit ----------------------------------------------------

function open() {
    const addModal = $('#add-modal');
    if (!addModal) return;

    const form = /** @type {HTMLFormElement|null} */ ($('#expense-form'));
    if (form) form.reset();

    const cat = /** @type {HTMLInputElement|null} */ ($('#expense-category'));
    const sub = /** @type {HTMLInputElement|null} */ ($('#expense-subcategory'));
    const date = /** @type {HTMLInputElement|null} */ ($('#expense-date'));
    if (cat) cat.value = '';
    if (sub) sub.value = '';
    if (date) date.value = todayLocalIso();

    const catSel = $('#picker-category-selected');
    const subSel = $('#picker-subcategory-selected');
    if (catSel) catSel.textContent = 'Pick one';
    if (subSel) subSel.textContent = 'Pick one';

    const subSection = /** @type {HTMLElement|null} */ ($('#subcategory-section'));
    if (subSection) subSection.style.display = 'none';
    const subChips = $('#expense-subcategory-chips');
    if (subChips) subChips.innerHTML = '';

    currentTypeFilter = 'expense';
    $$('.type-filter-btn').forEach(b => {
        b.classList.toggle('active', /** @type {HTMLElement} */ (b).dataset.type === currentTypeFilter);
    });

    buildCategoryPicker();
    addModal.classList.add('active');
    setStage('category');
}

async function handleSubmit(e) {
    e.preventDefault();

    const cat = /** @type {HTMLInputElement|null} */ ($('#expense-category'));
    const sub = /** @type {HTMLInputElement|null} */ ($('#expense-subcategory'));
    const date = /** @type {HTMLInputElement|null} */ ($('#expense-date'));
    const amt = /** @type {HTMLInputElement|null} */ ($('#expense-amount'));
    const desc = /** @type {HTMLInputElement|null} */ ($('#expense-description'));
    if (!cat || !sub || !date || !amt || !desc) return;

    if (!cat.value) { toast('Please pick a category', 'warning'); return; }
    if (!sub.value) { toast('Please pick a subcategory', 'warning'); return; }

    const selectedCategory = cat.value;
    const transactionType = isIncome(selectedCategory) ? 'income' : 'expense';
    const settings = store.getState().settings || {};

    const input = {
        id: Date.now().toString(),
        type: transactionType,
        date: date.value,
        category: selectedCategory,
        subcategory: sub.value,
        amount: parseFloat(amt.value),
        description: desc.value.trim(),
        currency: /** @type {any} */ (settings).currency
    };

    const bridge = /** @type {any} */ (window).__bridge;
    const result = bridge?.actions?.addExpense(input, { isIncomeCategory: isIncome });
    if (!result || !result.ok) {
        toast(result?.error || 'Could not save entry', 'warning');
        return;
    }
    // Legacy app.js still owns its own `expenses` array; keep it in sync via
    // the setter it exposes for the bridge.
    /** @type {any} */ (window).__setLegacyExpenses?.(result.list);

    // Legacy renderers (not yet subscribed). Phase A3 makes these reactive.
    /** @type {any} */ (window).renderExpenses?.();
    /** @type {any} */ (window).updateStats?.();
    /** @type {any} */ (window).renderCharts?.();
    /** @type {any} */ (window).checkBudgetAlert?.();

    amt.value = '';
    desc.value = '';
    sub.value = '';

    const addModal = $('#add-modal');
    if (addModal) addModal.classList.remove('active');

    toast('Entry logged successfully!', 'success');
}

// ---------- mount ------------------------------------------------------------

export function mount() {
    const form = $('#expense-form');
    if (!form) {
        $log.warn('expense-form not found; add-modal not mounted');
        return;
    }
    form.addEventListener('submit', handleSubmit);

    const amt = $('#expense-amount');
    if (amt) amt.addEventListener('input', refreshStage);

    $$('.type-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.type-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTypeFilter = /** @type {HTMLElement} */ (btn).dataset.type || 'expense';
            buildCategoryPicker();
        });
    });

    $$('.view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = /** @type {HTMLElement} */ (btn).dataset.view || 'grid';
            try { localStorage.setItem('categoryPickerView', view); } catch {}
            const grid = $('#expense-category-grid');
            if (grid) /** @type {HTMLElement} */ (grid).dataset.view = view;
            $$('.view-toggle-btn').forEach(b => {
                b.classList.toggle('active', /** @type {HTMLElement} */ (b).dataset.view === view);
            });
        });
    });

    const cancel = $('#add-cancel');
    if (cancel) cancel.addEventListener('click', () => {
        const m = $('#add-modal');
        if (m) m.classList.remove('active');
    });

    const close = $('#add-close');
    if (close) close.addEventListener('click', () => {
        const m = $('#add-modal');
        if (m) m.classList.remove('active');
    });

    const modal = $('#add-modal');
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Rebuild picker when categories change (e.g., from Settings)
    store.subscribe(EVENTS.CATEGORIES_CHANGED, () => {
        if ($('#add-modal')?.classList.contains('active')) buildCategoryPicker();
    });

    // Expose for legacy app.js (nav button, header button,
    // populateCategoryDropdowns, quickAdd* helpers that still live there
    // and need to rebuild the picker / pick the freshly-added category).
    const bridge = /** @type {any} */ (window).__bridge || ((/** @type {any} */ (window).__bridge = {}));
    bridge.openAddModal = open;
    bridge.rebuildAddCategoryPicker = buildCategoryPicker;
    bridge.rebuildAddSubcategoryChips = buildSubcategoryChips;
    bridge.selectAddCategory = selectCategory;
}
