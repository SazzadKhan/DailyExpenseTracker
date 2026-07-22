// js/features/assistant/provider-openai.js
// OpenAI Chat Completions adapter — also drives every OpenAI-compatible vendor
// (OpenRouter, Groq, DeepSeek, Mistral, Together, xAI, Gemini's compat endpoint,
// or any custom base URL). The wire shape is identical; only the base URL and
// key change. Raw fetch (no build step / npm in this repo). The key is the
// user's own, stored locally, sent only to the vendor they chose.

/**
 * @param {{ apiKey:string, model:string, baseUrl:string, system:string,
 *           userText:string, schema?:object }} opts
 * @returns {Promise<{ ok:true, text:string } | { ok:false, error:string }>}
 */
export async function sendOpenAICompatible({ apiKey, model, baseUrl, system, userText, schema }) {
    const url = `${baseUrl}/chat/completions`;
    const body = {
        model,
        max_tokens: 1024,
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

    let resp = await post(url, apiKey, body);

    // User-editable model / arbitrary vendor: many models reject json_schema
    // response_format. Retry once without the constraint and rely on JSON parsing.
    if (resp.status === 400 && schema) {
        const msg = await errorMessage(resp);
        if (/response_format|json_schema|schema|not supported|unsupported/i.test(msg)) {
            delete body.response_format;
            resp = await post(url, apiKey, body);
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

/**
 * Lists models the account can access — also doubles as a connection/key check.
 * @param {{ apiKey:string, baseUrl:string }} opts
 * @returns {Promise<{ ok:true, models:{id:string,label:string}[] } | { ok:false, error:string }>}
 */
export async function listOpenAIModels({ apiKey, baseUrl }) {
    let resp;
    try {
        resp = await fetch(`${baseUrl}/models`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
    } catch (_) {
        return { ok: false, error: 'Network error — check your connection and the base URL.' };
    }
    if (!resp.ok) return { ok: false, error: await errorMessage(resp) };

    const data = await resp.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    if (!list.length) return { ok: false, error: 'Connected, but no models were returned for this account.' };
    const models = list
        // Google's OpenAI-compat endpoint returns its native "models/xyz" resource
        // names, but the chat endpoint expects the bare id — strip it so the id
        // we hand back is the one that will actually work in a chat request.
        .map(m => { const id = String(m.id).replace(/^models\//, ''); return { id, label: id }; })
        .sort((a, b) => a.id.localeCompare(b.id));
    return { ok: true, models };
}

function post(url, apiKey, body) {
    return fetch(url, {
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
        return j?.error?.message || `API error (HTTP ${resp.status})`;
    } catch (_) {
        return `API error (HTTP ${resp.status})`;
    }
}
