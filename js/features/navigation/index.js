// js/features/navigation/index.js
// Bottom-nav tab switching, header "Log Entry" button, and delegated
// edit/delete + tap-to-expand for the dashboard "Recent Activity" cards.

import { $, $$ } from '../../core/dom.js';
import { open as openAddModal } from '../expenses/add-modal.js';
import { open as openEditModal, close as closeEditModal } from '../expenses/edit-modal.js';
import { remove as removeExpense } from '../expenses/actions.js';

/**
 * Switch the active nav-page. Exported so other features (e.g. contextual
 * "how it works" links) can navigate without faking a nav-item click.
 * @param {string} page value matching a `.nav-item[data-page]` / `.nav-page[data-page]`
 */
export function navigateTo(page) {
    // Special popup pages
    if (page === 'add') {
        openAddModal();
        return;
    }

    const bottomNav = $('#bottom-nav');
    if (bottomNav) {
        for (const item of bottomNav.querySelectorAll('.nav-item')) {
            item.classList.toggle('active', /** @type {HTMLElement} */ (item).dataset.page === page);
        }
    }

    for (const section of $$('.nav-page')) {
        section.classList.toggle('active', /** @type {HTMLElement} */ (section).dataset.page === page);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wireBottomNav() {
    const bottomNav = $('#bottom-nav');
    if (!bottomNav) return;
    for (const item of bottomNav.querySelectorAll('.nav-item')) {
        item.addEventListener('click', () => {
            const page = /** @type {HTMLElement} */ (item).dataset.page;
            if (page) navigateTo(page);
        });
    }
}

function wireHeaderAddBtn() {
    const btn = $('#header-add-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        openAddModal();
    });
}

function wireRecentActivity() {
    const roots = [$('#recent-expense-tbody'), $('#recent-expense-cards')].filter(Boolean);
    for (const root of roots) {
        root.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            const btn = target.closest('[data-action][data-id]');
            if (btn) {
                const id = /** @type {HTMLElement} */ (btn).dataset.id;
                const action = /** @type {HTMLElement} */ (btn).dataset.action;
                if (action === 'edit') openEditModal(id);
                else if (action === 'delete') removeExpense(id);
                return;
            }
            // Tap-to-expand on mobile cards
            const card = target.closest('.expense-card');
            if (!card || !root.contains(card)) return;
            const wasActive = card.classList.contains('active');
            for (const c of root.querySelectorAll('.expense-card.active')) c.classList.remove('active');
            if (!wasActive) card.classList.add('active');
        });
    }
}

function wireKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
        }
    });
}

export function mount() {
    wireBottomNav();
    wireHeaderAddBtn();
    wireRecentActivity();
    wireKeyboardShortcuts();
}
