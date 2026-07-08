// js/features/assistant/parser.js
// Rule-based natural-language expense parser (v1 fixed grammar).
// PURE MODULE: no DOM, no store, no localStorage — categories and dates come
// in as arguments so tests and the future quick-add box can reuse it.
//
// Pipeline: normalize → segment → extract(date, amount) → classify → score.
// Policy: never guess silently. Anything uncertain carries needsReview: true;
// anything unreadable lands in `unmatched` instead of becoming an entry.

import { getLocalDateString, normalizeDateString } from '../../core/format.js';
import { isIncomeCategory } from '../categories/categories.model.js';

/** @typedef {{ date:string, category:string, subcategory:string, amount:number,
 *              description:string, confidence:'high'|'medium'|'low',
 *              needsReview:boolean }} ParsedEntry */

const BN_DIGITS = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const CURRENCY_SYMBOLS = { '৳': 'BDT', '$': 'USD', '£': 'GBP', '€': 'EUR', '₹': 'INR', '¥': 'JPY' };
const CURRENCY_WORDS = {
    tk: 'BDT', taka: 'BDT', bdt: 'BDT', usd: 'USD', gbp: 'GBP',
    eur: 'EUR', rs: 'INR', inr: 'INR', jpy: 'JPY'
};
const CURRENCY_WORD_RE = /\b(tk|taka|bdt|usd|gbp|eur|rs|inr|jpy)\b\.?/gi;

// Words that flag financial-meaning ambiguity (refund = income? negative
// expense? credit-card payment isn't an expense at all). v1 flags, never guesses.
const REVIEW_WORDS = /\b(refund|transfer|repay(?:ment)?|credit\s*card)\b/i;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Common spoken words → [category, subcategory] against the DEFAULT category
// names. Applied only when that category actually exists in the user's data,
// and only after the user's own category/subcategory names failed to match —
// personal taxonomy always wins.
const SYNONYMS = {
    breakfast: ['Food & Dining', 'Restaurants'],
    lunch: ['Food & Dining', 'Restaurants'],
    dinner: ['Food & Dining', 'Restaurants'],
    restaurant: ['Food & Dining', 'Restaurants'],
    kacchi: ['Food & Dining', 'Restaurants'],
    biryani: ['Food & Dining', 'Restaurants'],
    tea: ['Food & Dining', 'Coffee & Snacks'],
    coffee: ['Food & Dining', 'Coffee & Snacks'],
    snack: ['Food & Dining', 'Coffee & Snacks'],
    snacks: ['Food & Dining', 'Coffee & Snacks'],
    grocery: ['Food & Dining', 'Groceries'],
    fish: ['Food & Dining', 'Groceries'],
    vegetables: ['Food & Dining', 'Groceries'],
    meat: ['Food & Dining', 'Groceries'],
    rice: ['Food & Dining', 'Groceries'],
    rickshaw: ['Transportation', 'Public Transit'],
    bus: ['Transportation', 'Public Transit'],
    train: ['Transportation', 'Public Transit'],
    metro: ['Transportation', 'Public Transit'],
    taxi: ['Transportation', 'Uber/Lyft'],
    uber: ['Transportation', 'Uber/Lyft'],
    cng: ['Transportation', 'Uber/Lyft'],
    pathao: ['Transportation', 'Uber/Lyft'],
    fuel: ['Transportation', 'Fuel/Gas'],
    petrol: ['Transportation', 'Fuel/Gas'],
    diesel: ['Transportation', 'Fuel/Gas'],
    rent: ['Bills & Utilities', 'Rent/Mortgage'],
    internet: ['Bills & Utilities', 'Internet'],
    wifi: ['Bills & Utilities', 'Internet'],
    broadband: ['Bills & Utilities', 'Internet'],
    electricity: ['Bills & Utilities', 'Electricity'],
    electric: ['Bills & Utilities', 'Electricity'],
    water: ['Bills & Utilities', 'Water'],
    phone: ['Bills & Utilities', 'Phone'],
    mobile: ['Bills & Utilities', 'Phone'],
    recharge: ['Bills & Utilities', 'Phone'],
    medicine: ['Healthcare', 'Medicine'],
    meds: ['Healthcare', 'Medicine'],
    doctor: ['Healthcare', 'Doctor Visit'],
    pharmacy: ['Healthcare', 'Pharmacy'],
    gym: ['Healthcare', 'Gym/Fitness'],
    movie: ['Entertainment', 'Movies'],
    cinema: ['Entertainment', 'Movies'],
    game: ['Entertainment', 'Games'],
    shirt: ['Shopping', 'Clothes'],
    shoes: ['Shopping', 'Clothes'],
    dress: ['Shopping', 'Clothes'],
    book: ['Education', 'Books'],
    haircut: ['Personal Care', 'Haircut'],
    salon: ['Personal Care', 'Haircut'],
    flight: ['Travel', 'Flights'],
    hotel: ['Travel', 'Hotels'],
    salary: ['Income', 'Salary'],
    freelance: ['Income', 'Freelance'],
    bonus: ['Income', 'Salary']
};

/**
 * Parse free text into candidate expense entries.
 * @param {string} text
 * @param {{ categories?: object, todayStr?: string, currencyCode?: string }} [ctx]
 * @returns {{ entries: ParsedEntry[], unmatched: string[] }}
 */
export function parse(text, ctx = {}) {
    const categories = ctx.categories || {};
    const todayStr = ctx.todayStr || getLocalDateString(new Date());
    const currencyCode = ctx.currencyCode || null;
    const index = buildKeywordIndex(categories);

    const entries = [];
    const unmatched = [];

    const segments = segment(normalize(String(text || '')));

    // First pass — extract date + amount per segment.
    const parts = segments.map(raw => {
        const d = extractDate(raw, todayStr);
        const a = extractAmount(d.cleaned);
        return { raw, date: d.date, cleaned: a.cleaned, amount: a.amount, currency: a.currency };
    });

    // Exactly one explicit date in the whole message → applies to every entry
    // ("lunch 150, rickshaw 40, tea 20 yesterday"). Per-segment dates override.
    const dated = parts.filter(p => p.date);
    const sharedDate = dated.length === 1 ? dated[0].date : null;

    for (const p of parts) {
        if (p.amount == null) {
            if (p.raw.trim()) unmatched.push(p.raw.trim());
            continue;
        }

        const match = matchCategory(p.cleaned, index, categories);
        const category = match ? match.category : fallbackCategory(categories);
        const subcategory = (match && match.subcategory) || fallbackSubcategory(categories, category);

        let confidence = match ? (match.subcategory ? 'high' : 'medium') : 'low';
        let needsReview = !match;
        if (REVIEW_WORDS.test(p.raw)) needsReview = true;
        if (currencyCode && p.currency && p.currency !== currencyCode) needsReview = true;
        if (needsReview && confidence === 'high') confidence = 'medium';

        entries.push({
            date: p.date || sharedDate || todayStr,
            category,
            subcategory,
            amount: p.amount,
            description: cleanDescription(p.cleaned) || subcategory,
            confidence,
            needsReview
        });
    }

    return { entries, unmatched };
}

/** Bengali digits → ASCII; "50k" → "50000". */
export function normalize(text) {
    let t = text.replace(/[০-৯]/g, ch => BN_DIGITS[ch] || ch);
    t = t.replace(/\b(\d+(?:\.\d+)?)\s*k\b/gi, (_, n) => String(Math.round(parseFloat(n) * 1000)));
    return t;
}

/**
 * Split a message into transaction candidates. Thousand-separator commas are
 * collapsed first ("1,200" → "1200") using a lookahead — no regex lookbehind
 * (unsupported on Safari <16.4). "and" splits only when every side contains a
 * number, so "groceries 500 and fish 350" splits but
 * "lunch and coffee for 450" stays one entry.
 */
export function segment(text) {
    const collapsed = text.replace(/(\d),(?=\d)/g, '$1');
    const rough = collapsed.split(/[\n;]+/).flatMap(p => p.split(','));

    const out = [];
    for (const part of rough) {
        for (const piece of splitOnAnd(part)) {
            const trimmed = piece.trim();
            if (trimmed) out.push(trimmed);
        }
    }
    return out;
}

function splitOnAnd(part) {
    const chunks = part.split(/\band\b/i);
    if (chunks.length < 2) return [part];
    return chunks.every(c => /\d/.test(c)) ? chunks : [part];
}

/**
 * Pull a date token out of the segment. Returns local YYYY-MM-DD or null.
 * @returns {{ date: string|null, cleaned: string }}
 */
export function extractDate(seg, todayStr) {
    const lit = seg.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (lit) return { date: normalizeDateString(lit[0]), cleaned: seg.replace(lit[0], ' ') };

    if (/\btoday\b/i.test(seg)) {
        return { date: todayStr, cleaned: seg.replace(/\btoday\b/gi, ' ') };
    }
    if (/\byesterday\b/i.test(seg)) {
        return { date: dateFromToday(todayStr, 1), cleaned: seg.replace(/\byesterday\b/gi, ' ') };
    }
    for (let dow = 0; dow < WEEKDAYS.length; dow++) {
        if (new RegExp(`\\b${WEEKDAYS[dow]}\\b`, 'i').test(seg)) {
            const diff = (dowOf(todayStr) - dow + 7) % 7; // 0 = today
            return {
                date: dateFromToday(todayStr, diff),
                cleaned: seg.replace(new RegExp(`\\b${WEEKDAYS[dow]}\\b`, 'gi'), ' ')
            };
        }
    }
    return { date: null, cleaned: seg };
}

/**
 * Last standalone number in the segment is the amount. Currency tokens are
 * detected (for conflict flagging) and stripped from the description.
 * @returns {{ amount: number|null, cleaned: string, currency: string|null }}
 */
export function extractAmount(seg) {
    const currency = detectCurrency(seg);
    const matches = [...seg.matchAll(/\d+(?:\.\d+)?/g)];
    if (!matches.length) return { amount: null, cleaned: seg, currency };

    const m = matches[matches.length - 1];
    const amount = Number(m[0]);
    const cleaned = stripCurrencyTokens(seg.slice(0, m.index) + seg.slice(m.index + m[0].length));
    if (!Number.isFinite(amount) || amount <= 0) return { amount: null, cleaned, currency };
    return { amount, cleaned, currency };
}

function detectCurrency(seg) {
    const sym = seg.match(/[৳$£€₹¥]/);
    if (sym) return CURRENCY_SYMBOLS[sym[0]];
    CURRENCY_WORD_RE.lastIndex = 0;
    const word = CURRENCY_WORD_RE.exec(seg);
    if (word) return CURRENCY_WORDS[word[1].toLowerCase()];
    return null;
}

function stripCurrencyTokens(s) {
    return s.replace(/[৳$£€₹¥]/g, ' ').replace(CURRENCY_WORD_RE, ' ');
}

/**
 * word → { category, subcategory|null } from the user's own category and
 * subcategory names. Subcategory entries win over category-only entries.
 */
export function buildKeywordIndex(categories) {
    const index = new Map();
    const put = (word, val) => {
        const w = word.toLowerCase();
        if (w.length < 3 || w === 'other' || w === 'and') return;
        const existing = index.get(w);
        if (!existing || (!existing.subcategory && val.subcategory)) index.set(w, val);
    };
    for (const [name, def] of Object.entries(categories || {})) {
        put(name, { category: name, subcategory: null });
        for (const w of splitWords(name)) put(w, { category: name, subcategory: null });
        for (const sub of def?.subcategories || []) {
            put(sub, { category: name, subcategory: sub });
            for (const w of splitWords(sub)) put(w, { category: name, subcategory: sub });
        }
    }
    return index;
}

function splitWords(s) {
    return s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Match segment words against the user's taxonomy first, then the built-in
 * synonym map (validated against the user's actual categories).
 * @returns {{ category:string, subcategory:string|null } | null}
 */
export function matchCategory(cleaned, index, categories) {
    const words = splitWords(cleaned.toLowerCase());

    let catOnly = null;
    for (const w of words) {
        const hit = index.get(w);
        if (hit?.subcategory) return hit;
        if (hit && !catOnly) catOnly = hit;
    }
    if (catOnly) return catOnly;

    for (const w of words) {
        const syn = SYNONYMS[w] || SYNONYMS[w.replace(/s$/, '')];
        if (!syn) continue;
        const [cat, sub] = syn;
        if (!categories?.[cat]) continue; // user renamed/deleted it — no guess
        const subs = categories[cat].subcategories || [];
        return { category: cat, subcategory: subs.includes(sub) ? sub : null };
    }
    return null;
}

/** 'Other' if the user still has it, else the first non-income category. */
export function fallbackCategory(categories) {
    const names = Object.keys(categories || {});
    if (names.includes('Other')) return 'Other';
    return names.find(n => !isIncomeCategory(n)) || names[0] || 'Other';
}

/** 'Other' subcategory if present, else the category's first subcategory. */
export function fallbackSubcategory(categories, category) {
    const subs = categories?.[category]?.subcategories || [];
    if (subs.includes('Other')) return 'Other';
    return subs[0] || 'Other';
}

function cleanDescription(s) {
    return s.replace(/\s+/g, ' ').replace(/^[\s,.;:!-]+|[\s,.;:!-]+$/g, '').trim();
}

function dowOf(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
}

function dateFromToday(todayStr, daysAgo) {
    const [y, m, d] = todayStr.split('-').map(Number);
    return getLocalDateString(new Date(y, m - 1, d - daysAgo));
}
