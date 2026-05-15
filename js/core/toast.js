// js/core/toast.js
// Lightweight transient notification. Pure UI — no state, no store deps.

/**
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type]
 */
export function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const icon = type === 'success' ? '✅'
               : type === 'error'   ? '❌'
               : type === 'warning' ? '⚠️'
               : 'ℹ️';

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message"></span>
    `;
    toast.querySelector('.toast-message').textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
