// js/features/categories/emoji-picker.js
// Reusable emoji-picker controller. Two pickers exist in the DOM:
//   - #new-emoji-picker   (Add Category form)
//   - #edit-emoji-picker  (Edit Category modal)
// Both are populated on demand and hidden on outside-click.

import { EMOJI_LIST } from '../../core/constants.js';

export function buildEmojiPicker(containerEl, displayBtn, getSelected, setSelected) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    const current = getSelected();
    EMOJI_LIST.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-btn' + (emoji === current ? ' selected' : '');
        btn.textContent = emoji;
        btn.title = emoji;
        btn.addEventListener('click', () => {
            setSelected(emoji);
            if (displayBtn) displayBtn.textContent = emoji;
            containerEl.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            containerEl.style.display = 'none';
        });
        containerEl.appendChild(btn);
    });
}

export function toggleEmojiPicker(containerEl, displayBtn, getSelected, setSelected) {
    if (!containerEl) return;
    if (containerEl.style.display === 'none' || containerEl.style.display === '') {
        buildEmojiPicker(containerEl, displayBtn, getSelected, setSelected);
        containerEl.style.display = 'grid';
    } else {
        containerEl.style.display = 'none';
    }
}

// Hide any open pickers when clicking outside them.
export function mountOutsideClickClose(pickerIds) {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.emoji-picker-wrapper') || e.target.closest('.emoji-picker-grid')) return;
        pickerIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    });
}
