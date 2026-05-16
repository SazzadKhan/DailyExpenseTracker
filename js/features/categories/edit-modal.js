// js/features/categories/edit-modal.js
// "Edit Category" modal: rename + change icon. Save flows through
// actions.renameCategory.

import * as actions from './actions.js';
import { store } from '../../core/store.js';
import { toggleEmojiPicker } from './emoji-picker.js';
import { showToast } from '../../core/toast.js';
import { log } from '../../core/log.js';

const $log = log('categories/edit-modal');

let modal, nameInput, iconBtn, pickerEl, closeBtn, cancelBtn, saveBtn;
let editingName = null;
let selectedIcon = '📁';

export function open(name) {
    const cats = store.getState().categories || {};
    if (!cats[name]) return;
    editingName = name;
    selectedIcon = cats[name].icon || '📁';
    nameInput.value = name;
    iconBtn.textContent = selectedIcon;
    if (pickerEl) pickerEl.style.display = 'none';
    modal.classList.add('active');
}

export function close() {
    modal.classList.remove('active');
    editingName = null;
    if (pickerEl) pickerEl.style.display = 'none';
}

function save() {
    if (!editingName) return;
    const newName = (nameInput?.value || '').trim();
    const r = actions.renameCategory(editingName, newName, selectedIcon);
    if (!r.ok) { showToast(r.error, 'warning'); return; }
    close();
    showToast('Category updated', 'success');
}

export function mount() {
    modal = document.getElementById('edit-category-modal');
    if (!modal) return;
    nameInput = document.getElementById('edit-category-name');
    iconBtn   = document.getElementById('edit-category-icon-btn');
    pickerEl  = document.getElementById('edit-emoji-picker');
    closeBtn  = document.getElementById('edit-category-close');
    cancelBtn = document.getElementById('edit-category-cancel');
    saveBtn   = document.getElementById('edit-category-save');

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    saveBtn?.addEventListener('click', save);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    iconBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiPicker(pickerEl, iconBtn,
            () => selectedIcon,
            (v) => { selectedIcon = v; }
        );
    });

    $log.info('mounted');
}
