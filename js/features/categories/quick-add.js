// js/features/categories/quick-add.js
// "+" buttons inside the Log/Add modal that prompt the user for a new
// category or subcategory name, then create it via the categories actions
// and select it in the add-modal picker.

import { store } from '../../core/store.js';
import { addCategory, addSubcategory } from './actions.js';
import { showToast } from '../../core/toast.js';
import { dialog } from '../../services/dialog.js';
import {
    buildCategoryPicker as rebuildAddCategoryPicker,
    buildSubcategoryChips as rebuildAddSubcategoryChips,
    selectCategory as selectAddCategory
} from '../expenses/add-modal.js';

export async function quickAddCategoryFromLog() {
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

    const result = addCategory(trimmed, '📁');
    if (!result.ok) {
        showToast(result.error || 'Could not add category', 'warning');
        return;
    }

    rebuildAddCategoryPicker();
    selectAddCategory(trimmed);
    showToast(`Added “${trimmed}”`, 'success');
}

export async function quickAddSubcategoryFromLog(category) {
    if (!category) return;
    const cats = store.getState().categories || {};
    if (!cats[category]) return;

    const name = await dialog.prompt({
        title: `New subcategory in “${category}”`,
        placeholder: 'e.g. Coffee',
        confirmText: 'Add',
        tone: 'question'
    });
    if (name == null) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;

    const result = addSubcategory(category, trimmed);
    if (!result.ok) {
        showToast(result.error || 'Could not add subcategory', 'warning');
        return;
    }

    rebuildAddSubcategoryChips(category);

    // Auto-select the new subcategory in the add modal.
    const sub = /** @type {HTMLInputElement|null} */ (document.getElementById('expense-subcategory'));
    if (sub) sub.value = trimmed;
    for (const c of document.querySelectorAll('#expense-subcategory-chips .chip')) {
        c.classList.toggle('selected', /** @type {HTMLElement} */ (c).dataset.sub === trimmed);
    }
    const subSel = document.getElementById('picker-subcategory-selected');
    if (subSel) subSel.textContent = trimmed;
}
