// js/features/assistant/settings.js
// Assistant settings pane (provider / model / API key / base URL, per vendor).
// Deliberately does NOT use the settings-object save pattern from budget-form.js:
// storage.saveSettings() mirrors the settings object to the user's Google Sheet,
// and API keys must never leave this browser. These values live in their own
// localStorage keys, with one config remembered per provider so switching
// vendors keeps each vendor's key and model.

import { $, on, el, delegate } from '../../core/dom.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { showToast } from '../../core/toast.js';
import { PROVIDERS, defaultModelFor, listModels } from './providers.js';

/** @returns {object} per-provider stash: { [id]: { model, apiKey, baseUrl } } */
function readStash() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ASSISTANT_PROVIDERS) || '{}') || {};
    } catch (_) {
        return {};
    }
}

function writeStash(stash) {
    localStorage.setItem(STORAGE_KEYS.ASSISTANT_PROVIDERS, JSON.stringify(stash));
}

/** @returns {{ provider:string, model:string, apiKey:string, baseUrl:string }} active config */
export function getAssistantConfig() {
    try {
        const provider = localStorage.getItem(STORAGE_KEYS.ASSISTANT_PROVIDER) || 'anthropic';
        const entry = readStash()[provider];
        if (entry) {
            return {
                provider,
                model: entry.model || '',
                apiKey: entry.apiKey || '',
                baseUrl: entry.baseUrl || ''
            };
        }
        // No stash entry yet → legacy single-config values (they belong to the
        // active provider, since that's the only one migrated users configured).
        return {
            provider,
            model: localStorage.getItem(STORAGE_KEYS.ASSISTANT_MODEL) || '',
            apiKey: localStorage.getItem(STORAGE_KEYS.ASSISTANT_API_KEY) || '',
            baseUrl: ''
        };
    } catch (_) {
        return { provider: 'anthropic', model: '', apiKey: '', baseUrl: '' };
    }
}

export function mountAssistantSettings() {
    const provider = $('#assistant-provider');
    const model = $('#assistant-model');
    const key = $('#assistant-api-key');
    const baseUrlGroup = $('#assistant-baseurl-group');
    const baseUrl = $('#assistant-base-url');
    const keyHelp = $('#assistant-key-help');
    const save = $('#assistant-save-btn');
    const checkBtn = $('#assistant-check-btn');
    const modelMenu = $('#assistant-model-menu');
    if (!provider || !model || !key || !save) return;

    let fetchedModels = [];

    function renderModelMenu() {
        if (!modelMenu) return;
        modelMenu.innerHTML = '';
        for (const m of fetchedModels) {
            modelMenu.append(el('li', {},
                el('button', { type: 'button', dataset: { role: 'model-option', id: m.id } }, m.label)
            ));
        }
    }

    function setModelMenuOpen(open) {
        if (modelMenu) modelMenu.hidden = !open || fetchedModels.length === 0;
    }

    if (modelMenu) {
        delegate(modelMenu, 'click', '[data-role="model-option"]', (_ev, btn) => {
            model.value = /** @type {HTMLElement} */ (btn).dataset.id;
            // focus() fires the 'focus' listener below (which reopens the menu)
            // synchronously — close it after, so the close wins.
            model.focus();
            setModelMenuOpen(false);
        });
        on(model, 'focus', () => setModelMenuOpen(true));
        on(document, 'click', (e) => {
            if (!modelMenu.hidden && !modelMenu.contains(/** @type {Node} */ (e.target)) && e.target !== model) {
                setModelMenuOpen(false);
            }
        });
    }

    // Build the dropdown from the registry so vendors stay defined in one place.
    provider.innerHTML = '';
    for (const [id, def] of Object.entries(PROVIDERS)) {
        provider.append(new Option(def.label, id));
    }

    // Reflect a provider's stored values (or its defaults) into the fields.
    function applyProvider(id, values) {
        const def = PROVIDERS[id] || {};
        model.value = values.model || defaultModelFor(id);
        model.placeholder = def.defaultModel || 'model name';
        key.value = values.apiKey || '';
        key.placeholder = def.keyHint ? `Paste your key (${def.keyHint})` : 'Paste your API key';
        if (baseUrlGroup && baseUrl) {
            // Toggle inline display, not the `hidden` attribute: the .form-group
            // class sets an explicit display that overrides [hidden].
            baseUrlGroup.style.display = id === 'custom' ? '' : 'none';
            baseUrl.value = values.baseUrl || '';
        }
        if (keyHelp) {
            keyHelp.hidden = !def.keysUrl;
            if (def.keysUrl) keyHelp.href = def.keysUrl;
        }
    }

    // Read what's currently on screen.
    function currentFields() {
        return {
            model: model.value.trim(),
            apiKey: key.value.trim(),
            baseUrl: baseUrl ? baseUrl.value.trim() : ''
        };
    }

    const cfg = getAssistantConfig();
    let current = PROVIDERS[cfg.provider] ? cfg.provider : 'anthropic';
    provider.value = current;
    applyProvider(current, cfg);

    on(provider, 'change', () => {
        // Stash the fields under the provider we're leaving, then load the new one.
        const stash = readStash();
        stash[current] = currentFields();
        writeStash(stash);
        current = provider.value;
        applyProvider(current, stash[current] || {});
        // Yesterday's provider's models don't apply to the new one.
        fetchedModels = [];
        renderModelMenu();
        setModelMenuOpen(false);
    });

    if (checkBtn) {
        on(checkBtn, 'click', async () => {
            const fields = currentFields();
            if (!fields.apiKey) {
                showToast('Paste an API key first', 'error');
                return;
            }
            const prevLabel = checkBtn.textContent;
            checkBtn.disabled = true;
            checkBtn.textContent = 'Checking…';
            try {
                const res = await listModels({
                    provider: current,
                    apiKey: fields.apiKey,
                    baseUrl: fields.baseUrl
                });
                if (!res.ok) {
                    showToast(`Connection failed: ${res.error}`, 'error');
                    return;
                }
                fetchedModels = res.models;
                renderModelMenu();
                if (!model.value.trim() && res.models[0]) model.value = res.models[0].id;
                setModelMenuOpen(true);
                showToast(`Connected — ${res.models.length} model${res.models.length === 1 ? '' : 's'} available`, 'success');
            } catch (_) {
                showToast('Connection check failed', 'error');
            } finally {
                checkBtn.disabled = false;
                checkBtn.textContent = prevLabel;
            }
        });
    }

    on(save, 'click', () => {
        try {
            const fields = currentFields();
            const stash = readStash();
            stash[current] = fields;
            writeStash(stash);
            localStorage.setItem(STORAGE_KEYS.ASSISTANT_PROVIDER, current);
            // Mirror the active provider into the legacy keys for backward compat.
            localStorage.setItem(STORAGE_KEYS.ASSISTANT_MODEL, fields.model);
            if (fields.apiKey) localStorage.setItem(STORAGE_KEYS.ASSISTANT_API_KEY, fields.apiKey);
            else localStorage.removeItem(STORAGE_KEYS.ASSISTANT_API_KEY);
            showToast(fields.apiKey ? 'Assistant settings saved — AI mode on' : 'Assistant settings saved — free parser mode', 'success');
        } catch (_) {
            showToast('Could not save assistant settings', 'error');
        }
    });
}
