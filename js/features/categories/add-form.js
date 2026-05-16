// js/features/categories/add-form.js
// Settings → Categories tab: "Add Category" form + the legacy
// "Add Subcategory" picker (kept for parity; chips are the main UI now).
// Both forms dispatch through actions.* so the store re-renders the list.

import * as actions from './actions.js';
import { store } from '../../core/store.js';
import { EVENTS } from '../../core/events.js';
import { toggleEmojiPicker, mountOutsideClickClose } from './emoji-picker.js';
import { showToast } from '../../core/toast.js';
import { log } from '../../core/log.js';

const $log = log('categories/add-form');

let newNameInput, newIconBtn, newPickerEl, addBtn;
let subCatSelect, subListEl, subNameInput, addSubBtn;
let selectedNewIcon = '📁';

function toast(msg, type = 'info') { showToast(msg, type); }

function resetNewForm() {
    newNameInput.value = '';
    selectedNewIcon = '📁';
    newIconBtn.textContent = '📁';
    if (newPickerEl) newPickerEl.style.display = 'none';
}

function handleAddCategory() {
    const name = (newNameInput.value || '').trim();
    const r = actions.addCategory(name, selectedNewIcon || '📁');
    if (!r.ok) { toast(r.error, 'warning'); return; }
    resetNewForm();
    toast(`Category "${name}" added!`, 'success');
}

function renderSubList() {
    if (!subListEl || !subCatSelect) return;
    subListEl.innerHTML = '';
    const selected = subCatSelect.value;
    const cats = store.getState().categories || {};
    if (!selected || !cats[selected]) return;

    cats[selected].subcategories.forEach(sub => {
        const item = document.createElement('div');
        item.className = 'subcategory-item';
        const label = document.createElement('span');
        label.textContent = sub;
        const btn = document.createElement('button');
        btn.className = 'btn-delete-category';
        btn.textContent = '🗑️';
        btn.addEventListener('click', () => {
            const r = actions.deleteSubcategory(selected, sub);
            if (!r.ok) toast(r.error, 'warning');
        });
        item.appendChild(label);
        item.appendChild(btn);
        subListEl.appendChild(item);
    });
}

function handleAddSubcategory() {
    if (!subCatSelect || !subNameInput) return;
    const category = subCatSelect.value;
    if (!category) { toast('Please select a category first', 'warning'); return; }
    const name = (subNameInput.value || '').trim();
    const r = actions.addSubcategory(category, name);
    if (!r.ok) { toast(r.error, 'warning'); return; }
    subNameInput.value = '';
}

export function mount() {
    newNameInput = document.getElementById('new-category-name');
    newIconBtn   = document.getElementById('new-category-icon-btn');
    newPickerEl  = document.getElementById('new-emoji-picker');
    addBtn       = document.getElementById('add-category');

    subCatSelect = document.getElementById('subcategory-category');
    subListEl    = document.getElementById('subcategory-list');
    subNameInput = document.getElementById('new-subcategory-name');
    addSubBtn    = document.getElementById('add-subcategory');

    addBtn?.addEventListener('click', handleAddCategory);
    newNameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
    });
    newIconBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiPicker(newPickerEl, newIconBtn,
            () => selectedNewIcon,
            (v) => { selectedNewIcon = v; }
        );
    });

    subCatSelect?.addEventListener('change', renderSubList);
    addSubBtn?.addEventListener('click', handleAddSubcategory);

    store.subscribe(EVENTS.CATEGORIES_CHANGED, renderSubList);
    mountOutsideClickClose(['new-emoji-picker', 'edit-emoji-picker']);

    $log.info('mounted');
}
