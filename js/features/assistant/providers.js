// js/features/assistant/providers.js
// Provider dispatcher for LLM mode. Adapters return { ok, text }; this module
// turns the text into parsed JSON. Keep provider specifics in the adapters.

import { sendAnthropic } from './provider-anthropic.js';
import { sendOpenAI } from './provider-openai.js';

/** Pre-fill defaults for the editable model field in settings. */
export const DEFAULT_MODELS = Object.freeze({
    anthropic: 'claude-opus-4-8',
    openai: 'gpt-4o-mini'
});

/**
 * @param {{ provider:string, apiKey:string, model:string, system:string,
 *           userText:string, schema:object }} opts
 * @returns {Promise<{ ok:true, data:object } | { ok:false, error:string }>}
 */
export async function sendChat(opts) {
    let res;
    if (opts.provider === 'anthropic') res = await sendAnthropic(opts);
    else if (opts.provider === 'openai') res = await sendOpenAI(opts);
    else return { ok: false, error: `Unknown provider: ${opts.provider}` };

    if (!res.ok) return res;
    const data = tryParseJson(res.text);
    if (!data || typeof data !== 'object') {
        return { ok: false, error: 'The model returned a response I could not read. Try a different model.' };
    }
    return { ok: true, data };
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
