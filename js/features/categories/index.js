// js/features/categories/index.js
// Mount entry for the categories feature.

import { mountDropdowns } from './dropdowns.js';
import { mount as mountList } from './list.js';
import { mount as mountEditModal } from './edit-modal.js';
import { mount as mountAddForm } from './add-form.js';

export function mount() {
    mountDropdowns();
    mountList();
    mountEditModal();
    mountAddForm();
}
