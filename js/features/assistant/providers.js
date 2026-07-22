// js/features/assistant/providers.js
// Provider dispatcher for LLM mode. Adapters return { ok, text }; this module
// turns the text into parsed JSON. Keep provider specifics in the adapters.

import { sendAnthropic, listAnthropicModels } from './provider-anthropic.js';
import { sendOpenAICompatible, listOpenAIModels } from './provider-openai.js';

/**
 * Supported LLM vendors. `kind` selects the wire adapter:
 *   - 'anthropic' → native Anthropic Messages API
 *   - 'openai'    → OpenAI Chat Completions shape; drives every OpenAI-compatible
 *                   vendor (only the base URL and key differ)
 * `baseUrl` is the API root for openai-kind vendors ('custom' has none — the
 * user supplies it in settings). `keyHint`/`keysUrl` help the user get a key.
 * @typedef {{ label:string, kind:'anthropic'|'openai', baseUrl?:string,
 *             defaultModel:string, keyHint:string, keysUrl:string }} ProviderDef
 */
export const PROVIDERS = Object.freeze({
    anthropic: {
        label: 'Anthropic (Claude)',
        kind: 'anthropic',
        defaultModel: 'claude-haiku-4-5',
        keyHint: 'sk-ant-…',
        keysUrl: 'https://console.anthropic.com/settings/keys'
    },
    openai: {
        label: 'OpenAI',
        kind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
        keyHint: 'sk-…',
        keysUrl: 'https://platform.openai.com/api-keys'
    },
    openrouter: {
        label: 'OpenRouter',
        kind: 'openai',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'openai/gpt-4o-mini',
        keyHint: 'sk-or-…',
        keysUrl: 'https://openrouter.ai/keys'
    },
    groq: {
        label: 'Groq',
        kind: 'openai',
        baseUrl: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama-3.3-70b-versatile',
        keyHint: 'gsk_…',
        keysUrl: 'https://console.groq.com/keys'
    },
    deepseek: {
        label: 'DeepSeek',
        kind: 'openai',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        keyHint: 'sk-…',
        keysUrl: 'https://platform.deepseek.com/api_keys'
    },
    mistral: {
        label: 'Mistral',
        kind: 'openai',
        baseUrl: 'https://api.mistral.ai/v1',
        defaultModel: 'mistral-small-latest',
        keyHint: '…',
        keysUrl: 'https://console.mistral.ai/api-keys'
    },
    together: {
        label: 'Together AI',
        kind: 'openai',
        baseUrl: 'https://api.together.xyz/v1',
        defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        keyHint: '…',
        keysUrl: 'https://api.together.ai/settings/api-keys'
    },
    xai: {
        label: 'xAI (Grok)',
        kind: 'openai',
        baseUrl: 'https://api.x.ai/v1',
        defaultModel: 'grok-2-latest',
        keyHint: 'xai-…',
        keysUrl: 'https://console.x.ai'
    },
    google: {
        label: 'Google (Gemini)',
        kind: 'openai',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultModel: 'gemini-2.0-flash',
        keyHint: '…',
        keysUrl: 'https://aistudio.google.com/apikey'
    },
    custom: {
        label: 'Custom (OpenAI-compatible)',
        kind: 'openai',
        baseUrl: '',
        defaultModel: '',
        keyHint: '…',
        keysUrl: ''
    }
});

/** Pre-fill default for the editable model field in settings. */
export function defaultModelFor(provider) {
    return PROVIDERS[provider]?.defaultModel || '';
}

/**
 * @param {{ provider:string, apiKey:string, model:string, baseUrl?:string,
 *           system:string, userText:string, schema:object }} opts
 * @returns {Promise<{ ok:true, data:object } | { ok:false, error:string }>}
 */
export async function sendChat(opts) {
    const def = PROVIDERS[opts.provider];
    if (!def) return { ok: false, error: `Unknown provider: ${opts.provider}` };

    let res;
    if (def.kind === 'anthropic') {
        res = await sendAnthropic(opts);
    } else {
        const baseUrl = (opts.baseUrl || def.baseUrl || '').trim().replace(/\/+$/, '');
        if (!baseUrl) {
            return { ok: false, error: 'This provider needs a base URL — add one in Assistant settings.' };
        }
        res = await sendOpenAICompatible({ ...opts, baseUrl });
    }

    if (!res.ok) return res;
    const data = tryParseJson(res.text);
    if (!data || typeof data !== 'object') {
        return { ok: false, error: 'The model returned a response I could not read. Try a different model.' };
    }
    return { ok: true, data };
}

/**
 * Lists the models an account can access. Also the connection/key check the
 * settings pane uses: a successful response proves the key and base URL work.
 * @param {{ provider:string, apiKey:string, baseUrl?:string }} opts
 * @returns {Promise<{ ok:true, models:{id:string,label:string}[] } | { ok:false, error:string }>}
 */
export async function listModels({ provider, apiKey, baseUrl }) {
    const def = PROVIDERS[provider];
    if (!def) return { ok: false, error: `Unknown provider: ${provider}` };
    if (!apiKey) return { ok: false, error: 'Paste an API key first.' };

    if (def.kind === 'anthropic') return listAnthropicModels({ apiKey });

    const base = (baseUrl || def.baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return { ok: false, error: 'This provider needs a base URL — add one above.' };
    return listOpenAIModels({ apiKey, baseUrl: base });
}

/**
 * Parse model output as JSON. Structured outputs return bare JSON, but the
 * model field is user-editable — older models may wrap it in ```json fences.
 * @returns {object|null}
 */
export function tryParseJson(text) {
    if (typeof text !== 'string') return null;
    let t = text.trim();
    const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (fence) t = fence[1];
    try {
        return JSON.parse(t);
    } catch (_) {
        return null;
    }
}
