// js/features/assistant/engine-llm.js
// LLM-mode orchestration: build the prompt, call the provider, and — the
// trust boundary — sanitize everything the model returns before it can reach
// the preview. The model proposes; this module (and the user's confirm)
// disposes. LLM entries flow through the same preview UI and audit log as
// parser entries.

import { getLocalDateString, normalizeDateString } from '../../core/format.js';
import { subcategoriesOf } from '../categories/categories.model.js';
import { sendChat } from './providers.js';
import { fallbackCategory, fallbackSubcategory } from './parser.js';

/** JSON schema the model must fill. Shared by both providers. */
export const ENTRY_SCHEMA = Object.freeze({
    type: 'object',
    properties: {
        entries: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'Local calendar date, YYYY-MM-DD' },
                    category: { type: 'string', description: 'One of the allowed category names, exactly as written' },
                    subcategory: { type: 'string', description: 'One of that category\'s subcategory names, exactly as written' },
                    amount: { type: 'number', description: 'Positive number, no currency symbols' },
                    description: { type: 'string', description: 'Short note in the user\'s words' }
                },
                required: ['date', 'category', 'subcategory', 'amount', 'description'],
                additionalProperties: false
            }
        },
        reply: { type: 'string', description: 'One short, friendly sentence summarizing what was understood' }
    },
    required: ['entries', 'reply'],
    additionalProperties: false
});

/**
 * @param {string} userText
 * @param {{ categories:object, settings:object,
 *           config:{ provider:string, apiKey:string, model:string } }} deps
 * @returns {Promise<{ ok:true, entries:object[], reply:string } | { ok:false, error:string }>}
 */
export async function extractWithLLM(userText, { categories, settings, config }) {
    const todayStr = getLocalDateString(new Date());
    const system = buildSystemPrompt({
        categories,
        todayStr,
        currency: settings?.currency || 'USD'
    });

    let res;
    try {
        res = await sendChat({
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
            system,
            userText,
            schema: ENTRY_SCHEMA
        });
    } catch (_) {
        return { ok: false, error: 'Network error — check your connection and try again.' };
    }
    if (!res.ok) return res;

    const raw = Array.isArray(res.data.entries) ? res.data.entries : [];
    return {
        ok: true,
        entries: sanitizeEntries(raw, categories, todayStr),
        reply: typeof res.data.reply === 'string' ? res.data.reply : ''
    };
}

function buildSystemPrompt({ categories, todayStr, currency }) {
    const catLines = Object.entries(categories || {})
        .map(([name, def]) => `- ${name}: ${(def?.subcategories || []).join(', ')}`)
        .join('\n');

    return [
        'You extract expense/income entries from a user\'s message for a personal expense tracker.',
        `Today's local date: ${todayStr}. The user's currency: ${currency}.`,
        'Allowed categories and their subcategories (use ONLY these, exactly as written):',
        catLines,
        'Rules:',
        '- Split the message into individual transactions.',
        '- amount: a positive number with no currency symbols.',
        '- date: local YYYY-MM-DD. No date mentioned = today. "yesterday" = today minus one day.',
        '- Never invent categories or subcategories. If unsure, use the "Other" options.',
        '- The message may mix languages (e.g. Bengali and English) — handle it.',
        '- reply: one short, friendly sentence summarizing what you understood.',
        'Respond with JSON only, matching the provided schema.'
    ].join('\n');
}

/**
 * Never trust the model: every field is validated against the user's actual
 * data. Anything remapped is flagged needsReview so the preview shows ⚠.
 */
export function sanitizeEntries(rawEntries, categories, todayStr) {
    const out = [];
    for (const raw of rawEntries) {
        const amount = Number(raw?.amount);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        let needsReview = false;
        let category = String(raw?.category || '');
        if (!categories?.[category]) {
            category = fallbackCategory(categories);
            needsReview = true;
        }

        let subcategory = String(raw?.subcategory || '');
        const subs = subcategoriesOf(categories, category);
        if (!subs.includes(subcategory)) {
            subcategory = fallbackSubcategory(categories, category);
            needsReview = true;
        }

        let date = normalizeDateString(String(raw?.date || ''));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = todayStr;

        out.push({
            date,
            category,
            subcategory,
            amount,
            description: String(raw?.description || '').slice(0, 200),
            confidence: needsReview ? 'low' : 'high',
            needsReview
        });
    }
    return out;
}
