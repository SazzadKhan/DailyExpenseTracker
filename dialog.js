/* ============================================================
   Custom in-app dialog: window.dialog.alert / confirm / prompt
   All async; return Promises. Drop-in replacements for the
   browser dialogs except they don't block the main thread.
   ============================================================ */
(function () {
    'use strict';

    const ICONS = {
        info:    'ℹ️',
        warn:    '⚠️',
        warning: '⚠️',
        danger:  '⚠️',
        error:   '⛔',
        success: '✅',
        question:'❓'
    };

    let activeResolver = null;
    let activeBackdrop = null;

    function ensureRoot() {
        let root = document.getElementById('app-dialog-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'app-dialog-root';
            document.body.appendChild(root);
        }
        return root;
    }

    function closeActive(value) {
        if (!activeBackdrop) return;
        const bd = activeBackdrop;
        const resolve = activeResolver;
        activeBackdrop = null;
        activeResolver = null;

        bd.classList.remove('open');
        // Wait for transition before removing
        setTimeout(() => bd.remove(), 250);
        if (resolve) resolve(value);
    }

    /**
     * @param {Object} opts
     * @param {'alert'|'confirm'|'prompt'} opts.kind
     * @param {string} opts.message
     * @param {string} [opts.title]
     * @param {string} [opts.confirmText]
     * @param {string} [opts.cancelText]
     * @param {'info'|'warn'|'danger'|'error'|'success'|'question'} [opts.tone]
     * @param {string} [opts.placeholder]
     * @param {string} [opts.defaultValue]
     * @returns {Promise<any>}
     */
    function open(opts) {
        // If a dialog is already open, close it first (rare but defensive).
        if (activeBackdrop) closeActive(opts.kind === 'confirm' ? false : null);

        const tone = opts.tone
            || (opts.kind === 'confirm' ? 'question'
              : opts.kind === 'prompt'  ? 'info'
              : 'info');

        const backdrop = document.createElement('div');
        backdrop.className = 'app-dialog-backdrop';

        const dialog = document.createElement('div');
        dialog.className = 'app-dialog';
        dialog.setAttribute('role', opts.kind === 'alert' ? 'alertdialog' : 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.dataset.tone = tone;

        const iconChar = ICONS[tone] || 'ℹ️';
        const titleText = opts.title || ({
            alert:   'Heads up',
            confirm: 'Are you sure?',
            prompt:  'Enter a value'
        })[opts.kind];

        const confirmText = opts.confirmText
            || (opts.kind === 'confirm' ? 'Confirm' : 'OK');
        const cancelText  = opts.cancelText  || 'Cancel';

        const inputHtml = opts.kind === 'prompt'
            ? `<input class="app-dialog-input" type="text" autocomplete="off"
                       placeholder="${escapeAttr(opts.placeholder || '')}"
                       value="${escapeAttr(opts.defaultValue || '')}">`
            : '';

        const showCancel = opts.kind !== 'alert';

        dialog.innerHTML = `
            <div class="app-dialog-head">
                <span class="app-dialog-icon">${iconChar}</span>
                <h3 class="app-dialog-title">${escapeHtml(titleText)}</h3>
            </div>
            <div class="app-dialog-body">${escapeHtml(opts.message || '')}</div>
            ${inputHtml}
            <div class="app-dialog-actions">
                ${showCancel ? `<button type="button" class="app-dialog-btn" data-role="cancel">${escapeHtml(cancelText)}</button>` : ''}
                <button type="button" class="app-dialog-btn ${tone === 'danger' || tone === 'error' ? 'danger' : 'primary'}" data-role="ok">${escapeHtml(confirmText)}</button>
            </div>
        `;
        backdrop.appendChild(dialog);
        ensureRoot().appendChild(backdrop);

        // Animate in
        requestAnimationFrame(() => backdrop.classList.add('open'));

        const inputEl = dialog.querySelector('.app-dialog-input');
        const okBtn   = dialog.querySelector('[data-role="ok"]');
        const noBtn   = dialog.querySelector('[data-role="cancel"]');

        const resolveOk = () => {
            if (opts.kind === 'prompt') closeActive(inputEl ? inputEl.value : '');
            else if (opts.kind === 'confirm') closeActive(true);
            else closeActive(true);
        };
        const resolveCancel = () => {
            if (opts.kind === 'prompt')  closeActive(null);
            else if (opts.kind === 'confirm') closeActive(false);
            else closeActive(false);
        };

        okBtn.addEventListener('click', resolveOk);
        if (noBtn) noBtn.addEventListener('click', resolveCancel);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) resolveCancel();
        });

        // Keyboard handling
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); resolveCancel(); }
            else if (e.key === 'Enter' && document.activeElement !== okBtn) {
                // Allow Enter inside the prompt input
                if (opts.kind === 'prompt' && document.activeElement === inputEl) {
                    e.preventDefault();
                    resolveOk();
                } else if (opts.kind !== 'prompt') {
                    e.preventDefault();
                    resolveOk();
                }
            }
        };
        document.addEventListener('keydown', onKey);

        return new Promise((resolve) => {
            activeBackdrop = backdrop;
            activeResolver = (value) => {
                document.removeEventListener('keydown', onKey);
                resolve(value);
            };
            // Focus the input if prompt, else the primary button.
            setTimeout(() => {
                if (inputEl) { inputEl.focus(); inputEl.select(); }
                else okBtn.focus();
            }, 30);
        });
    }

    function escapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, '&quot;');
    }

    // Public API ----------------------------------------------------------
    /**
     * @param {string|Object} msgOrOpts
     * @returns {Promise<true>}
     */
    function alertDialog(msgOrOpts) {
        const opts = typeof msgOrOpts === 'string' ? { message: msgOrOpts } : (msgOrOpts || {});
        return open({ ...opts, kind: 'alert' });
    }
    /**
     * @param {string|Object} msgOrOpts
     * @returns {Promise<boolean>}
     */
    function confirmDialog(msgOrOpts) {
        const opts = typeof msgOrOpts === 'string' ? { message: msgOrOpts } : (msgOrOpts || {});
        return open({ ...opts, kind: 'confirm' });
    }
    /**
     * @param {string|Object} msgOrOpts
     * @returns {Promise<string|null>}
     */
    function promptDialog(msgOrOpts) {
        const opts = typeof msgOrOpts === 'string' ? { message: msgOrOpts } : (msgOrOpts || {});
        return open({ ...opts, kind: 'prompt' });
    }

    window.dialog = {
        alert:   alertDialog,
        confirm: confirmDialog,
        prompt:  promptDialog
    };
})();
