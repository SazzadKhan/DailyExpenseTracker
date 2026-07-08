// js/features/assistant/provider-openai.js
// OpenAI Chat Completions adapter. Raw fetch (no build step / npm in this
// repo). The key is the user's own, stored locally, sent only to api.openai.com.

const API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * @param {{ apiKey:string, model:string, system:string, userText:string, schema?:object }} opts
 * @returns {Promise<{ ok:true, text:string } | { ok:false, error:string }>}
 */
export async function sendOpenAI({ apiKey, model, system, userText, schema }) {
    const body = {
        model,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: userText }
        ]
    };
    if (schema) {
        body.response_format = {
            type: 'json_schema',
            json_schema: { name: 'expense_extraction', strict: true, schema }
        };
    }

    let resp = await post(apiKey, body);

    // User-editable model: older models may reject json_schema response_format.
    // Retry once without the constraint and rely on JSON parsing instead.
    if (resp.status === 400 && schema) {
        const msg = await errorMessage(resp);
        if (/response_format|json_schema/i.test(msg)) {
            delete body.response_format;
            resp = await post(apiKey, body);
        } else {
            return { ok: false, error: msg };
        }
    }

    if (!resp.ok) return { ok: false, error: await errorMessage(resp) };

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: 'The model returned no text.' };
    return { ok: true, text };
}

function post(apiKey, body) {
    return fetch(API_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });
}

async function errorMessage(resp) {
    try {
        const j = await resp.json();
        return j?.error?.message || `OpenAI API error (HTTP ${resp.status})`;
    } catch (_) {
        return `OpenAI API error (HTTP ${resp.status})`;
    }
}
