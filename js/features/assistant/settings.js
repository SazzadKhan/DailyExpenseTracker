// js/features/assistant/settings.js
// Assistant settings pane (provider / model / API key). Deliberately does NOT
// use the settings-object save pattern from budget-form.js: storage.saveSettings()
// mirrors the settings object to the user's Google Sheet, and the API key must
// never leave this browser. These values live in their own localStorage keys.

import { $, on } from '../../core/dom.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { showToast } from '../../core/toast.js';
import { DEFAULT_MODELS } from './providers.js';

/** @returns {{ provider:string, model:string, apiKey:string }} */
export function getAssistantConfig() {
    try {
        return {
            provider: localStorage.getItem(STORAGE_KEYS.ASSISTANT_PROVIDER) || 'anthropic',
            model: localStorage.getItem(STORAGE_KEYS.ASSISTANT_MODEL) || '',
            apiKey: localStorage.getItem(STORAGE_KEYS.ASSISTANT_API_KEY) || ''
        };
    } catch (_) {
        return { provider: 'anthropic', model: '', apiKey: '' };
    }
}

export function mountAssistantSettings() {
    const provider = $('#assistant-provider');
    const model = $('#assistant-model');
    const key = $('#assistant-api-key');
    const save = $('#assistant-save-btn');
    if (!provider || !model || !key || !save) return;

    const cfg = getAssistantConfig();
    provider.value = cfg.provider;
    model.value = cfg.model || DEFAULT_MODELS[cfg.provider] || '';
    key.value = cfg.apiKey;

    on(provider, 'change', () => {
        // Pre-fill the default model, but never clobber a custom one.
        const cur = model.value.trim();
        if (!cur || Object.values(DEFAULT_MODELS).includes(cur)) {
            model.value = DEFAULT_MODELS[provider.value] || '';
        }
    });

    on(save, 'click', () => {
        try {
            localStorage.setItem(STORAGE_KEYS.ASSISTANT_PROVIDER, provider.value);
            localStorage.setItem(STORAGE_KEYS.ASSISTANT_MODEL, model.value.trim());
            const k = key.value.trim();
            if (k) localStorage.setItem(STORAGE_KEYS.ASSISTANT_API_KEY, k);
            else localStorage.removeItem(STORAGE_KEYS.ASSISTANT_API_KEY);
            showToast(k ? 'Assistant settings saved — AI mode on' : 'Assistant settings saved — free parser mode', 'success');
        } catch (_) {
            showToast('Could not save assistant settings', 'error');
        }
    });
}
