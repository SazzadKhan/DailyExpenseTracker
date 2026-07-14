// js/features/assistant/parser.js
// Rule-based natural-language expense parser (v2 fixed grammar).
// PURE MODULE: no DOM, no store, no localStorage — categories and dates come
// in as arguments so tests and the future quick-add box can reuse it.
//
// Pipeline: normalize → segment → extract(date, amount) → classify → score.
// Policy: never guess silently. Anything uncertain carries needsReview: true;
// anything unreadable lands in `unmatched` instead of becoming an entry.
//
// Classification order (first hit wins):
//   1. curated phrase overrides ("gas bill" is a utility, not vehicle fuel)
//   2. the user's own category/subcategory names (bigrams, then single words)
//   3. learned index — this user's accepted history (ctx.learned, learned.js)
//   4. built-in synonym pack (validated against the user's actual categories)
//   5. income-intent fallback ("got paid 20k"), else Other + review flag
//
// Income guard: a lone noun colliding with an income subcategory ("gift",
// "investment") must never flip a transaction to income. Only explicit income
// wording (INCOME_INTENT) may select an income category; collisions resolve
// to the expense reading and carry needsReview: true.

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
// expense? credit-card payment isn't an expense at all). Flags, never guesses.
const REVIEW_WORDS = /\b(refund|transfer|repay(?:ment)?|credit\s*card)\b/i;

// Explicit income wording. Deliberately narrow: bare "paid" is spending
// ("paid internet bill 1200"); only "got/was/were paid" is income.
const INCOME_INTENT = /\b(?:got|was|were)\s+paid\b|\b(?:salary|wages?|stipend|income|received|earn(?:ed|ing)?|freelanc(?:e|ing)|bonus|profit)\b/i;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Multi-word overrides checked before any word matching — curated for the
// collisions word matching gets wrong (a "gas bill" in BD is the cooking-gas
// utility, not vehicle fuel; a "mobile cover" is a purchase, not a phone
// bill). Each applies only if the target category still exists for this user.
const PHRASES = [
    [/\bgas\s+bill\b/i, 'Bills & Utilities', 'Other'],
    [/\b(?:current|electric(?:ity)?|bidyut)\s+bill\b/i, 'Bills & Utilities', 'Electricity'],
    [/\b(?:water|wasa)\s+bill\b/i, 'Bills & Utilities', 'Water'],
    [/\b(?:dish|cable)\s+bill\b/i, 'Bills & Utilities', 'Other'],
    [/\b(?:mobile|phone)\s+(?:cover|case)\b/i, 'Shopping', 'Electronics'],
    [/\b(?:air|plane|flight)\s+ticket\b/i, 'Travel', 'Flights'],
    [/\bcourse\s+fee\b/i, 'Education', 'Courses'],
    [/\b(?:school|college|tuition)\s+fee\b/i, 'Education', 'Tuition'],
    [/\b(?:blood|medical|lab)\s+test\b/i, 'Healthcare', 'Other'],
    [/\bice\s*cream\b/i, 'Food & Dining', 'Coffee & Snacks']
];

// Common spoken words → [category, subcategory|null] against the DEFAULT
// category names (null = category-level match; subcategory falls back later).
// Applied only when that category actually exists in the user's data, and
// only after the user's own category/subcategory names failed to match —
// personal taxonomy always wins. Includes Bangladeshi household vocabulary;
// grow this list from the audit log's intent misses, not from guessing.
const SYNONYMS = {
    // meals out
    breakfast: ['Food & Dining', 'Restaurants'],
    lunch: ['Food & Dining', 'Restaurants'],
    dinner: ['Food & Dining', 'Restaurants'],
    restaurant: ['Food & Dining', 'Restaurants'],
    kacchi: ['Food & Dining', 'Restaurants'],
    biryani: ['Food & Dining', 'Restaurants'],
    biriyani: ['Food & Dining', 'Restaurants'],
    khichuri: ['Food & Dining', 'Restaurants'],
    kebab: ['Food & Dining', 'Restaurants'],
    iftar: ['Food & Dining', null],
    market: ['Food & Dining', null],
    // street food / fast food
    burger: ['Food & Dining', 'Fast Food'],
    pizza: ['Food & Dining', 'Fast Food'],
    pasta: ['Food & Dining', 'Fast Food'],
    shawarma: ['Food & Dining', 'Fast Food'],
    fuchka: ['Food & Dining', 'Fast Food'],
    chotpoti: ['Food & Dining', 'Fast Food'],
    jhalmuri: ['Food & Dining', 'Fast Food'],
    singara: ['Food & Dining', 'Fast Food'],
    samosa: ['Food & Dining', 'Fast Food'],
    // snacks & drinks
    tea: ['Food & Dining', 'Coffee & Snacks'],
    coffee: ['Food & Dining', 'Coffee & Snacks'],
    cha: ['Food & Dining', 'Coffee & Snacks'],
    chai: ['Food & Dining', 'Coffee & Snacks'],
    snack: ['Food & Dining', 'Coffee & Snacks'],
    juice: ['Food & Dining', 'Coffee & Snacks'],
    chips: ['Food & Dining', 'Coffee & Snacks'],
    biscuit: ['Food & Dining', 'Coffee & Snacks'],
    cake: ['Food & Dining', 'Coffee & Snacks'],
    pastry: ['Food & Dining', 'Coffee & Snacks'],
    icecream: ['Food & Dining', 'Coffee & Snacks'],
    mishti: ['Food & Dining', 'Coffee & Snacks'],
    sweet: ['Food & Dining', 'Coffee & Snacks'],
    dessert: ['Food & Dining', 'Coffee & Snacks'],
    // groceries
    grocery: ['Food & Dining', 'Groceries'],
    bazar: ['Food & Dining', 'Groceries'],
    bazaar: ['Food & Dining', 'Groceries'],
    fish: ['Food & Dining', 'Groceries'],
    vegetable: ['Food & Dining', 'Groceries'],
    meat: ['Food & Dining', 'Groceries'],
    rice: ['Food & Dining', 'Groceries'],
    chal: ['Food & Dining', 'Groceries'],
    dal: ['Food & Dining', 'Groceries'],
    lentil: ['Food & Dining', 'Groceries'],
    egg: ['Food & Dining', 'Groceries'],
    milk: ['Food & Dining', 'Groceries'],
    bread: ['Food & Dining', 'Groceries'],
    fruit: ['Food & Dining', 'Groceries'],
    banana: ['Food & Dining', 'Groceries'],
    mango: ['Food & Dining', 'Groceries'],
    potato: ['Food & Dining', 'Groceries'],
    onion: ['Food & Dining', 'Groceries'],
    garlic: ['Food & Dining', 'Groceries'],
    ginger: ['Food & Dining', 'Groceries'],
    oil: ['Food & Dining', 'Groceries'],
    sugar: ['Food & Dining', 'Groceries'],
    salt: ['Food & Dining', 'Groceries'],
    flour: ['Food & Dining', 'Groceries'],
    atta: ['Food & Dining', 'Groceries'],
    masala: ['Food & Dining', 'Groceries'],
    spice: ['Food & Dining', 'Groceries'],
    chicken: ['Food & Dining', 'Groceries'],
    beef: ['Food & Dining', 'Groceries'],
    mutton: ['Food & Dining', 'Groceries'],
    prawn: ['Food & Dining', 'Groceries'],
    shrimp: ['Food & Dining', 'Groceries'],
    foodpanda: ['Food & Dining', 'Delivery'],
    // transport
    rickshaw: ['Transportation', 'Public Transit'],
    bus: ['Transportation', 'Public Transit'],
    train: ['Transportation', 'Public Transit'],
    metro: ['Transportation', 'Public Transit'],
    launch: ['Transportation', 'Public Transit'],
    boat: ['Transportation', 'Public Transit'],
    ferry: ['Transportation', 'Public Transit'],
    tempo: ['Transportation', 'Public Transit'],
    leguna: ['Transportation', 'Public Transit'],
    taxi: ['Transportation', 'Uber/Lyft'],
    uber: ['Transportation', 'Uber/Lyft'],
    cng: ['Transportation', 'Uber/Lyft'],
    pathao: ['Transportation', 'Uber/Lyft'],
    ola: ['Transportation', 'Uber/Lyft'],
    fuel: ['Transportation', 'Fuel/Gas'],
    petrol: ['Transportation', 'Fuel/Gas'],
    diesel: ['Transportation', 'Fuel/Gas'],
    octane: ['Transportation', 'Fuel/Gas'],
    servicing: ['Transportation', 'Car Maintenance'],
    bike: ['Transportation', null],
    motorcycle: ['Transportation', null],
    toll: ['Transportation', null],
    // bills & utilities
    rent: ['Bills & Utilities', 'Rent/Mortgage'],
    internet: ['Bills & Utilities', 'Internet'],
    wifi: ['Bills & Utilities', 'Internet'],
    broadband: ['Bills & Utilities', 'Internet'],
    electricity: ['Bills & Utilities', 'Electricity'],
    electric: ['Bills & Utilities', 'Electricity'],
    desco: ['Bills & Utilities', 'Electricity'],
    bidyut: ['Bills & Utilities', 'Electricity'],
    water: ['Bills & Utilities', 'Water'],
    wasa: ['Bills & Utilities', 'Water'],
    phone: ['Bills & Utilities', 'Phone'],
    mobile: ['Bills & Utilities', 'Phone'],
    recharge: ['Bills & Utilities', 'Phone'],
    titas: ['Bills & Utilities', null],
    // healthcare
    medicine: ['Healthcare', 'Medicine'],
    meds: ['Healthcare', 'Medicine'],
    napa: ['Healthcare', 'Medicine'],
    paracetamol: ['Healthcare', 'Medicine'],
    antibiotic: ['Healthcare', 'Medicine'],
    tablet: ['Healthcare', 'Medicine'],
    syrup: ['Healthcare', 'Medicine'],
    vitamin: ['Healthcare', 'Medicine'],
    doctor: ['Healthcare', 'Doctor Visit'],
    checkup: ['Healthcare', 'Doctor Visit'],
    pharmacy: ['Healthcare', 'Pharmacy'],
    gym: ['Healthcare', 'Gym/Fitness'],
    dentist: ['Healthcare', 'Dental'],
    hospital: ['Healthcare', null],
    clinic: ['Healthcare', null],
    // entertainment
    movie: ['Entertainment', 'Movies'],
    cinema: ['Entertainment', 'Movies'],
    game: ['Entertainment', 'Games'],
    netflix: ['Entertainment', 'Streaming Services'],
    spotify: ['Entertainment', 'Streaming Services'],
    hoichoi: ['Entertainment', 'Streaming Services'],
    chorki: ['Entertainment', 'Streaming Services'],
    cricket: ['Entertainment', 'Sports'],
    football: ['Entertainment', 'Sports'],
    // shopping
    shirt: ['Shopping', 'Clothes'],
    shoe: ['Shopping', 'Clothes'],
    dress: ['Shopping', 'Clothes'],
    panjabi: ['Shopping', 'Clothes'],
    saree: ['Shopping', 'Clothes'],
    sari: ['Shopping', 'Clothes'],
    lungi: ['Shopping', 'Clothes'],
    pant: ['Shopping', 'Clothes'],
    jean: ['Shopping', 'Clothes'],
    trouser: ['Shopping', 'Clothes'],
    jacket: ['Shopping', 'Clothes'],
    headphone: ['Shopping', 'Electronics'],
    earphone: ['Shopping', 'Electronics'],
    charger: ['Shopping', 'Electronics'],
    laptop: ['Shopping', 'Electronics'],
    keyboard: ['Shopping', 'Electronics'],
    gadget: ['Shopping', 'Electronics'],
    detergent: ['Shopping', 'Home & Garden'],
    tissue: ['Shopping', 'Home & Garden'],
    bulb: ['Shopping', 'Home & Garden'],
    watch: ['Shopping', null],
    bag: ['Shopping', null],
    // education
    book: ['Education', 'Books'],
    notebook: ['Education', 'Supplies'],
    khata: ['Education', 'Supplies'],
    pen: ['Education', 'Supplies'],
    pencil: ['Education', 'Supplies'],
    tuition: ['Education', 'Tuition'],
    udemy: ['Education', 'Courses'],
    coursera: ['Education', 'Courses'],
    school: ['Education', null],
    college: ['Education', null],
    university: ['Education', null],
    exam: ['Education', null],
    // personal care
    haircut: ['Personal Care', 'Haircut'],
    salon: ['Personal Care', 'Haircut'],
    barber: ['Personal Care', 'Haircut'],
    facial: ['Personal Care', 'Spa/Massage'],
    lipstick: ['Personal Care', 'Cosmetics'],
    shampoo: ['Personal Care', null],
    soap: ['Personal Care', null],
    toothpaste: ['Personal Care', null],
    toothbrush: ['Personal Care', null],
    lotion: ['Personal Care', null],
    parlour: ['Personal Care', null],
    parlor: ['Personal Care', null],
    // travel
    flight: ['Travel', 'Flights'],
    plane: ['Travel', 'Flights'],
    hotel: ['Travel', 'Hotels'],
    resort: ['Travel', 'Hotels'],
    visa: ['Travel', null],
    tour: ['Travel', null],
    // giving
    donation: ['Other', 'Charity'],
    zakat: ['Other', 'Charity'],
    sadaqah: ['Other', 'Charity'],
    // income (reachable only alongside INCOME_INTENT wording)
    salary: ['Income', 'Salary'],
    freelance: ['Income', 'Freelance'],
    bonus: ['Income', 'Salary'],
    wage: ['Income', 'Salary'],
    stipend: ['Income', 'Salary']
};

/** Synonym map keyed by folded word, built once. */
const SYN = new Map();
for (const [k, v] of Object.entries(SYNONYMS)) SYN.set(fold(k), v);

/**
 * Parse free text into candidate expense entries.
 * @param {string} text
 * @param {{ categories?: object, todayStr?: string, currencyCode?: string,
 *           learned?: Map<string, {category:string, subcategory:string|null, income:boolean}> }} [ctx]
 * @returns {{ entries: ParsedEntry[], unmatched: string[] }}
 */
export function parse(text, ctx = {}) {
    const categories = ctx.categories || {};
    const todayStr = ctx.todayStr || getLocalDateString(new Date());
    const currencyCode = ctx.currencyCode || null;
    const learned = ctx.learned || null;
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

        const incomeIntent = INCOME_INTENT.test(p.raw);
        const match = matchCategory(p.cleaned, index, categories, { incomeIntent, learned });

        let category, subcategory, confidence, needsReview;
        if (match) {
            category = match.category;
            subcategory = match.subcategory || fallbackSubcategory(categories, match.category);
            confidence = match.subcategory ? 'high' : 'medium';
            needsReview = !!match.incomeAmbiguous;
        } else if (incomeIntent && incomeCategoryOf(categories)) {
            // "got paid 20k" — explicit income wording, no category word needed.
            category = incomeCategoryOf(categories);
            subcategory = fallbackSubcategory(categories, category);
            confidence = 'medium';
            needsReview = false;
        } else {
            category = fallbackCategory(categories);
            subcategory = fallbackSubcategory(categories, category);
            confidence = 'low';
            needsReview = true;
        }

        // Bare "gas" is ambiguous in BD (cooking-gas cylinder vs vehicle fuel).
        // "gas bill" is caught by a phrase override; explicit fuel words pass.
        if (category === 'Transportation' && /\bgas\b/i.test(p.cleaned) &&
            !/\b(?:petrol|diesel|octane|fuel)\b/i.test(p.cleaned)) {
            needsReview = true;
        }
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

/** Case-fold + naive singular fold so "concert"/"Concerts" meet in the middle. */
export function fold(w) {
    w = w.toLowerCase();
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    return w;
}

export function foldWords(s) {
    return splitWords(s).map(fold);
}

/**
 * folded word/phrase → { expense?: hit, income?: hit } from the user's own
 * category and subcategory names. Two slots per key because a word can mean
 * both ("gift" → Income›Gift and Shopping›Gifts); which slot applies is
 * decided at match time by income intent. Subcategory entries win over
 * category-only entries within a slot. Multi-word names are also indexed as
 * one folded phrase key for the bigram pass ("public transit").
 */
const INDEX_CACHE = new WeakMap();

export function buildKeywordIndex(categories) {
    // Categories objects are replaced, never mutated (store rule #3), so the
    // object reference is a safe cache key across parse() calls.
    const cached = categories && INDEX_CACHE.get(categories);
    if (cached) return cached;
    const index = new Map();
    const putKey = (key, val) => {
        if (key.length < 3 || key === 'other' || key === 'and') return;
        const slot = val.income ? 'income' : 'expense';
        const entry = index.get(key) || {};
        const existing = entry[slot];
        if (!existing || (!existing.subcategory && val.subcategory)) entry[slot] = val;
        index.set(key, entry);
    };
    const addName = (name, val) => {
        const ws = foldWords(name);
        for (const w of ws) putKey(w, val);
        if (ws.length > 1) putKey(ws.join(' '), val);
    };
    for (const [name, def] of Object.entries(categories || {})) {
        const income = isIncomeCategory(name);
        addName(name, { category: name, subcategory: null, income });
        for (const sub of def?.subcategories || []) {
            addName(sub, { category: name, subcategory: sub, income });
        }
    }
    if (categories) INDEX_CACHE.set(categories, index);
    return index;
}

function splitWords(s) {
    return s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Match a segment against: curated phrases, then the user's taxonomy
 * (bigrams before single words), then the learned index (this user's
 * accepted history), then the synonym pack.
 * @param {string} cleaned segment with amount/date removed
 * @param {Map} index from buildKeywordIndex
 * @param {object} categories the user's categories
 * @param {{ incomeIntent?: boolean, learned?: Map|null }} [opts]
 * @returns {{ category:string, subcategory:string|null, incomeAmbiguous:boolean } | null}
 */
export function matchCategory(cleaned, index, categories, { incomeIntent = false, learned = null } = {}) {
    for (const [re, cat, sub] of PHRASES) {
        if (!re.test(cleaned) || !categories?.[cat]) continue;
        const subs = categories[cat].subcategories || [];
        return { category: cat, subcategory: subs.includes(sub) ? sub : null, incomeAmbiguous: false };
    }

    const words = foldWords(cleaned);
    let catOnly = null;
    let sawIncomeCollision = false;

    // Pick the slot the wording licenses: income needs explicit intent; a
    // word meaning both resolves to the expense reading but gets flagged.
    const resolve = (hit) => {
        if (!hit) return null;
        if (incomeIntent && hit.income) return hit.income;
        if (hit.income) sawIncomeCollision = true;
        return hit.expense || null;
    };

    const keys = [];
    for (let i = 0; i + 1 < words.length; i++) keys.push(words[i] + ' ' + words[i + 1]);
    keys.push(...words);

    for (const k of keys) {
        const v = resolve(index.get(k));
        if (!v) continue;
        if (v.subcategory) {
            return { category: v.category, subcategory: v.subcategory, incomeAmbiguous: sawIncomeCollision };
        }
        if (!catOnly) catOnly = v;
    }

    // Learned index — the user's own accepted history. Beats the generic
    // synonym pack, and a subcategory-level hit beats a category-only
    // taxonomy hit. Same income guard as everything else: learned mappings
    // into an income category need explicit income wording.
    if (learned) {
        for (const w of words) {
            const hit = learned.get(w);
            if (!hit) continue;
            if (hit.income && !incomeIntent) { sawIncomeCollision = true; continue; }
            if (hit.subcategory) {
                return { category: hit.category, subcategory: hit.subcategory, incomeAmbiguous: sawIncomeCollision };
            }
            if (!catOnly) catOnly = hit;
        }
    }

    if (catOnly) {
        return { category: catOnly.category, subcategory: null, incomeAmbiguous: sawIncomeCollision };
    }

    for (const w of words) {
        const syn = SYN.get(w);
        if (!syn) continue;
        const [cat, sub] = syn;
        if (!categories?.[cat]) continue; // user renamed/deleted it — no guess
        if (isIncomeCategory(cat) && !incomeIntent) { sawIncomeCollision = true; continue; }
        const subs = categories[cat].subcategories || [];
        return {
            category: cat,
            subcategory: sub && subs.includes(sub) ? sub : null,
            incomeAmbiguous: sawIncomeCollision
        };
    }
    return null;
}

/** The user's income category, if they still have one. */
function incomeCategoryOf(categories) {
    return Object.keys(categories || {}).find(isIncomeCategory) || null;
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
