// js/features/assistant/provider-anthropic.js
// Anthropic Messages API adapter. Raw fetch — this app has no build step or
// npm, so the official SDK is not an option. The dangerous-direct-browser
// header is Anthropic's supported opt-in for browser calls; the key is the
// user's own and never leaves their machine except to api.anthropic.com.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODELS_URL = 'https://api.anthropic.com/v1/models';

/**
 * @param {{ apiKey:string, model:string, system:string, userText:string, schema?:object }} opts
 * @returns {Promise<{ ok:true, text:string } | { ok:false, error:string }>}
 */
export async function sendAnthropic({ apiKey, model, system, userText, schema }) {
    const body = {
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userText }]
    };
    if (schema) {
        body.output_config = { format: { type: 'json_schema', schema } };
    }

    let resp = await post(apiKey, body);

    // User-editable model: older models may reject structured outputs.
    // Retry once without the constraint and rely on JSON parsing instead.
    if (resp.status === 400 && schema) {
        const msg = await errorMessage(resp);
        if (/output_config|json_schema|structured/i.test(msg)) {
            delete body.output_config;
            resp = await post(apiKey, body);
        } else {
            return { ok: false, error: msg };
        }
    }

    if (!resp.ok) return { ok: false, error: await errorMessage(resp) };

    const data = await resp.json();
    if (data.stop_reason === 'refusal') {
        return { ok: false, error: 'The model declined that request. Try rephrasing.' };
    }
    const block = (data.content || []).find(b => b.type === 'text');
    if (!block || !block.text) return { ok: false, error: 'The model returned no text.' };
    return { ok: true, text: block.text };
}

/**
 * Lists models the account can access — also doubles as a connection/key check.
 * @param {{ apiKey:string }} opts
 * @returns {Promise<{ ok:true, models:{id:string,label:string}[] } | { ok:false, error:string }>}
 */
export async function listAnthropicModels({ apiKey }) {
    let resp;
    try {
        resp = await fetch(MODELS_URL, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            }
        });
    } catch (_) {
        return { ok: false, error: 'Network error — check your connection.' };
    }
    if (!resp.ok) return { ok: false, error: await errorMessage(resp) };

    const data = await resp.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    if (!list.length) return { ok: false, error: 'Connected, but no models were returned for this account.' };
    const models = list.map(m => ({ id: m.id, label: m.display_name || m.id }));
    return { ok: true, models };
}

function post(apiKey, body) {
    return fetch(API_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
    });
}

async function errorMessage(resp) {
    try {
        const j = await resp.json();
        return j?.error?.message || `Anthropic API error (HTTP ${resp.status})`;
    } catch (_) {
        return `Anthropic API error (HTTP ${resp.status})`;
    }
}
