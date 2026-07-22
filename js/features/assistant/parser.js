// js/features/assistant/parser.js
// Rule-based natural-language expense parser (v3 run-on grammar).
// PURE MODULE: no DOM, no store, no localStorage — categories and dates come
// in as arguments so tests and the future quick-add box can reuse it.
//
// Pipeline: normalize (digits, typos, k-shorthand) → segment (commas, "and",
// "এবং/ar/nd") → per segment: extract date → pair-split run-on lines
// ("50 banna 50 riksha" → two candidates) → extract amount → classify → score.
// Policy: never guess silently. Anything uncertain carries needsReview: true;
// anything unreadable lands in `unmatched` instead of becoming an entry.
//
// Classification order (first hit wins):
//   1. curated phrase overrides ("gas bill" is a utility, not vehicle fuel)
//   2. the user's own category/subcategory names (bigrams, then single words)
//   3. learned index — this user's accepted history (ctx.learned, learned.js)
//   4. built-in synonym pack (validated against the user's actual categories)
//   5. typo tolerance — unique edit-distance-1 match into 2–4's vocabulary
//   6. income-intent fallback ("got paid 20k"), else Other + review flag
// Exception: a single word borrowed from a MULTI-word category name ("bill"
// from "Bills & Utilities") is a weak fragment — a subcategory-level synonym
// or typo hit beats it ("netflix er bill" files under Streaming Services).
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

// High-frequency misspellings seen in BD usage, fixed before anything else so
// date/income grammar sees the corrected words too. Whole words only. Generic
// one-letter typos are handled later by the edit-distance pass; this map is
// for the ones that are 2+ edits away or collide with other vocabulary
// ("lanch" is one edit from both lunch and launch — curate the winner).
const TYPOS = {
    payement: 'payment', lanch: 'lunch', riksha: 'rickshaw', ricksha: 'rickshaw',
    medisin: 'medicine', sallary: 'salary', salery: 'salary', shampu: 'shampoo',
    grosari: 'grocery', chikin: 'chicken', farmacy: 'pharmacy'
};

// Words that flag financial-meaning ambiguity (refund = income? negative
// expense? credit-card payment isn't an expense at all; a loan is neither
// income nor spending). Flags, never guesses.
const REVIEW_WORDS = /\b(refund|transfer(?:red|ring)?|repay(?:ment)?|credit\s*card|borrow(?:ed)?|lent|loans?|dhar)\b|ধার/i;

// Explicit income wording. Deliberately narrow: bare "paid" is spending
// ("paid internet bill 1200"); only "got/was/were paid" is income. Includes
// Banglish: beton (salary), pelam (received), dhukse/dhuklo (got credited).
// "sold" counts as intent, but when the words around it match an expense
// category ("sold old phone") parse() flags the conflict instead of guessing.
// Bengali script uses RECEIPT verbs only (পেলাম got / পেয়েছি received /
// ঢুকেছে credited) — bare "বেতন" is NOT intent, because "স্কুলের বেতন" is
// school FEES going out. (No \b around Bengali: word-boundary is ASCII-only.)
const INCOME_INTENT = /\b(?:got|was|were)\s+(?:paid|payments?)\b|\b(?:salary|wages?|stipend|income|received|earn(?:ed|ing)?|freelanc(?:e|ing)|bonus|profit|sold|beton|pelam|dhuk(?:se|lo|eche))\b|(?:পেলাম|পেয়েছি|ঢুক(?:েছে|ছে|লো)|ইনকাম|স্যালারি)/i;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// A number followed by one of these is a quantity, not a price ("2 kg chal
// 140", "iftar for 40 people 3000"). Checked in folded form.
const UNIT_WORDS = new Set([
    'kg', 'kgs', 'kilo', 'gram', 'gm', 'litre', 'liter', 'ltr', 'pc', 'pcs',
    'piece', 'dozen', 'hali', 'packet', 'people', 'person', 'jon', 'gula',
    'gulo', 'day', 'din', 'hour', 'month', 'km', 'min', 'minute', 'time', 'item'
]);

// Leading verbs that precede an amount without being part of the item
// ("spent 500 uber 300 coffee" — 500 belongs to uber). Folded form.
const LEAD_VERBS = new Set([
    'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'purchased', 'got',
    'gave', 'give', 'took', 'take', 'cost', 'total', 'khoroch', 'kinlam',
    'dilam', 'korlam', 'holo'
]);

// Common English words that must never be "corrected" into vocabulary by the
// edit-distance pass ("later" is one edit from "water").
const FUZZY_SKIP = new Set([
    'about', 'after', 'again', 'before', 'could', 'friend', 'hello', 'later',
    'other', 'please', 'right', 'saving', 'should', 'still', 'thanks', 'their',
    'there', 'these', 'those', 'today', 'total', 'where', 'which', 'while',
    'would', 'worth',
    // month names ("march" is one edit from "mach" — fish)
    'january', 'february', 'march', 'april', 'august', 'september',
    'october', 'november', 'december'
]);

// Multi-word overrides checked before any word matching — curated for the
// collisions word matching gets wrong (a "gas bill" in BD is the cooking-gas
// utility, not vehicle fuel; a "mobile cover" is a purchase, not a phone
// bill). Each applies only if the target category still exists for this user.
const PHRASES = [
    [/\bgas\s+bill\b/i, 'Bills & Utilities', 'Other'],
    [/\b(?:current|electric(?:ity)?|bidyut)\s+bill\b/i, 'Bills & Utilities', 'Electricity'],
    [/\b(?:water|wasa|pani)\s+bill\b/i, 'Bills & Utilities', 'Water'],
    [/\bpathao\s+food\b/i, 'Food & Dining', 'Delivery'],
    // Bengali script (no \b — ASCII-only): bill phrases from bn-BD dictation
    [/(?:কারেন্ট|বিদ্যুৎ|ইলেকট্রিক)\s*বিল/, 'Bills & Utilities', 'Electricity'],
    [/পানির?\s*বিল/, 'Bills & Utilities', 'Water'],
    [/গ্যাস(?:ের)?\s*বিল/, 'Bills & Utilities', 'Other'],
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
// personal taxonomy always wins. Includes Bangladeshi household vocabulary
// in Latin AND Bengali script; grow this list from the audit log's intent
// misses, not from guessing.
const SYNONYMS = {
    // meals out
    breakfast: ['Food & Dining', 'Restaurants'],
    lunch: ['Food & Dining', 'Restaurants'],
    'লাঞ্চ': ['Food & Dining', 'Restaurants'],
    dinner: ['Food & Dining', 'Restaurants'],
    'ডিনার': ['Food & Dining', 'Restaurants'],
    restaurant: ['Food & Dining', 'Restaurants'],
    kacchi: ['Food & Dining', 'Restaurants'],
    biryani: ['Food & Dining', 'Restaurants'],
    biriyani: ['Food & Dining', 'Restaurants'],
    'বিরিয়ানি': ['Food & Dining', 'Restaurants'],
    khichuri: ['Food & Dining', 'Restaurants'],
    kebab: ['Food & Dining', 'Restaurants'],
    iftar: ['Food & Dining', null],
    market: ['Food & Dining', null],
    nasta: ['Food & Dining', 'Coffee & Snacks'],
    'নাস্তা': ['Food & Dining', 'Coffee & Snacks'],
    pani: ['Food & Dining', null],
    'পানি': ['Food & Dining', null],
    'খাবার': ['Food & Dining', null],
    'ভাত': ['Food & Dining', null],
    // street food / fast food
    burger: ['Food & Dining', 'Fast Food'],
    'বার্গার': ['Food & Dining', 'Fast Food'],
    pizza: ['Food & Dining', 'Fast Food'],
    'পিজা': ['Food & Dining', 'Fast Food'],
    'পিৎজা': ['Food & Dining', 'Fast Food'],
    pasta: ['Food & Dining', 'Fast Food'],
    shawarma: ['Food & Dining', 'Fast Food'],
    fuchka: ['Food & Dining', 'Fast Food'],
    'ফুচকা': ['Food & Dining', 'Fast Food'],
    chotpoti: ['Food & Dining', 'Fast Food'],
    jhalmuri: ['Food & Dining', 'Fast Food'],
    'ঝালমুড়ি': ['Food & Dining', 'Fast Food'],
    singara: ['Food & Dining', 'Fast Food'],
    'সিঙ্গারা': ['Food & Dining', 'Fast Food'],
    samosa: ['Food & Dining', 'Fast Food'],
    // snacks & drinks
    tea: ['Food & Dining', 'Coffee & Snacks'],
    coffee: ['Food & Dining', 'Coffee & Snacks'],
    'কফি': ['Food & Dining', 'Coffee & Snacks'],
    cha: ['Food & Dining', 'Coffee & Snacks'],
    chai: ['Food & Dining', 'Coffee & Snacks'],
    'চা': ['Food & Dining', 'Coffee & Snacks'],
    snack: ['Food & Dining', 'Coffee & Snacks'],
    juice: ['Food & Dining', 'Coffee & Snacks'],
    chips: ['Food & Dining', 'Coffee & Snacks'],
    biscuit: ['Food & Dining', 'Coffee & Snacks'],
    'বিস্কুট': ['Food & Dining', 'Coffee & Snacks'],
    cake: ['Food & Dining', 'Coffee & Snacks'],
    pastry: ['Food & Dining', 'Coffee & Snacks'],
    popcorn: ['Food & Dining', 'Coffee & Snacks'],
    icecream: ['Food & Dining', 'Coffee & Snacks'],
    mishti: ['Food & Dining', 'Coffee & Snacks'],
    'মিষ্টি': ['Food & Dining', 'Coffee & Snacks'],
    sweet: ['Food & Dining', 'Coffee & Snacks'],
    dessert: ['Food & Dining', 'Coffee & Snacks'],
    // groceries
    grocery: ['Food & Dining', 'Groceries'],
    bazar: ['Food & Dining', 'Groceries'],
    bazaar: ['Food & Dining', 'Groceries'],
    'বাজার': ['Food & Dining', 'Groceries'],
    fish: ['Food & Dining', 'Groceries'],
    mach: ['Food & Dining', 'Groceries'],
    'মাছ': ['Food & Dining', 'Groceries'],
    vegetable: ['Food & Dining', 'Groceries'],
    shobji: ['Food & Dining', 'Groceries'],
    'সবজি': ['Food & Dining', 'Groceries'],
    meat: ['Food & Dining', 'Groceries'],
    mangsho: ['Food & Dining', 'Groceries'],
    'মাংস': ['Food & Dining', 'Groceries'],
    rice: ['Food & Dining', 'Groceries'],
    chal: ['Food & Dining', 'Groceries'],
    'চাল': ['Food & Dining', 'Groceries'],
    dal: ['Food & Dining', 'Groceries'],
    'ডাল': ['Food & Dining', 'Groceries'],
    lentil: ['Food & Dining', 'Groceries'],
    egg: ['Food & Dining', 'Groceries'],
    dim: ['Food & Dining', 'Groceries'],
    'ডিম': ['Food & Dining', 'Groceries'],
    milk: ['Food & Dining', 'Groceries'],
    dudh: ['Food & Dining', 'Groceries'],
    'দুধ': ['Food & Dining', 'Groceries'],
    doi: ['Food & Dining', 'Groceries'],
    'দই': ['Food & Dining', 'Groceries'],
    bread: ['Food & Dining', 'Groceries'],
    pauruti: ['Food & Dining', 'Groceries'],
    'পাউরুটি': ['Food & Dining', 'Groceries'],
    'রুটি': ['Food & Dining', 'Groceries'],
    fruit: ['Food & Dining', 'Groceries'],
    banana: ['Food & Dining', 'Groceries'],
    'কলা': ['Food & Dining', 'Groceries'],
    'ফল': ['Food & Dining', 'Groceries'],
    mango: ['Food & Dining', 'Groceries'],
    jackfruit: ['Food & Dining', 'Groceries'],
    'কাঁঠাল': ['Food & Dining', 'Groceries'],
    potato: ['Food & Dining', 'Groceries'],
    alu: ['Food & Dining', 'Groceries'],
    'আলু': ['Food & Dining', 'Groceries'],
    onion: ['Food & Dining', 'Groceries'],
    'পেঁয়াজ': ['Food & Dining', 'Groceries'],
    garlic: ['Food & Dining', 'Groceries'],
    ginger: ['Food & Dining', 'Groceries'],
    oil: ['Food & Dining', 'Groceries'],
    tel: ['Food & Dining', 'Groceries'],
    'তেল': ['Food & Dining', 'Groceries'],
    sugar: ['Food & Dining', 'Groceries'],
    chini: ['Food & Dining', 'Groceries'],
    'চিনি': ['Food & Dining', 'Groceries'],
    salt: ['Food & Dining', 'Groceries'],
    flour: ['Food & Dining', 'Groceries'],
    atta: ['Food & Dining', 'Groceries'],
    'আটা': ['Food & Dining', 'Groceries'],
    masala: ['Food & Dining', 'Groceries'],
    spice: ['Food & Dining', 'Groceries'],
    chicken: ['Food & Dining', 'Groceries'],
    murgi: ['Food & Dining', 'Groceries'],
    'মুরগি': ['Food & Dining', 'Groceries'],
    beef: ['Food & Dining', 'Groceries'],
    goru: ['Food & Dining', 'Groceries'],
    'গরু': ['Food & Dining', 'Groceries'],
    mutton: ['Food & Dining', 'Groceries'],
    prawn: ['Food & Dining', 'Groceries'],
    shrimp: ['Food & Dining', 'Groceries'],
    agora: ['Food & Dining', 'Groceries'],
    shwapno: ['Food & Dining', 'Groceries'],
    chaldal: ['Food & Dining', 'Groceries'],
    foodpanda: ['Food & Dining', 'Delivery'],
    // transport
    rickshaw: ['Transportation', 'Public Transit'],
    'রিকশা': ['Transportation', 'Public Transit'],
    bus: ['Transportation', 'Public Transit'],
    'বাস': ['Transportation', 'Public Transit'],
    train: ['Transportation', 'Public Transit'],
    'ট্রেন': ['Transportation', 'Public Transit'],
    metro: ['Transportation', 'Public Transit'],
    'মেট্রো': ['Transportation', 'Public Transit'],
    launch: ['Transportation', 'Public Transit'],
    'লঞ্চ': ['Transportation', 'Public Transit'],
    boat: ['Transportation', 'Public Transit'],
    ferry: ['Transportation', 'Public Transit'],
    tempo: ['Transportation', 'Public Transit'],
    leguna: ['Transportation', 'Public Transit'],
    taxi: ['Transportation', 'Uber/Lyft'],
    uber: ['Transportation', 'Uber/Lyft'],
    'উবার': ['Transportation', 'Uber/Lyft'],
    cng: ['Transportation', 'Uber/Lyft'],
    'সিএনজি': ['Transportation', 'Uber/Lyft'],
    pathao: ['Transportation', 'Uber/Lyft'],
    'পাঠাও': ['Transportation', 'Uber/Lyft'],
    ola: ['Transportation', 'Uber/Lyft'],
    fuel: ['Transportation', 'Fuel/Gas'],
    petrol: ['Transportation', 'Fuel/Gas'],
    'পেট্রোল': ['Transportation', 'Fuel/Gas'],
    diesel: ['Transportation', 'Fuel/Gas'],
    'ডিজেল': ['Transportation', 'Fuel/Gas'],
    octane: ['Transportation', 'Fuel/Gas'],
    'অকটেন': ['Transportation', 'Fuel/Gas'],
    servicing: ['Transportation', 'Car Maintenance'],
    bike: ['Transportation', null],
    motorcycle: ['Transportation', null],
    toll: ['Transportation', null],
    gari: ['Transportation', null],
    'গাড়ি': ['Transportation', null],
    // bills & utilities
    rent: ['Bills & Utilities', 'Rent/Mortgage'],
    internet: ['Bills & Utilities', 'Internet'],
    'ইন্টারনেট': ['Bills & Utilities', 'Internet'],
    wifi: ['Bills & Utilities', 'Internet'],
    'ওয়াইফাই': ['Bills & Utilities', 'Internet'],
    broadband: ['Bills & Utilities', 'Internet'],
    electricity: ['Bills & Utilities', 'Electricity'],
    'বিদ্যুৎ': ['Bills & Utilities', 'Electricity'],
    'কারেন্ট': ['Bills & Utilities', 'Electricity'],
    electric: ['Bills & Utilities', 'Electricity'],
    desco: ['Bills & Utilities', 'Electricity'],
    bidyut: ['Bills & Utilities', 'Electricity'],
    water: ['Bills & Utilities', 'Water'],
    wasa: ['Bills & Utilities', 'Water'],
    phone: ['Bills & Utilities', 'Phone'],
    mobile: ['Bills & Utilities', 'Phone'],
    'মোবাইল': ['Bills & Utilities', 'Phone'],
    'ফোন': ['Bills & Utilities', 'Phone'],
    recharge: ['Bills & Utilities', 'Phone'],
    'রিচার্জ': ['Bills & Utilities', 'Phone'],
    titas: ['Bills & Utilities', null],
    'বিল': ['Bills & Utilities', null],
    // healthcare
    medicine: ['Healthcare', 'Medicine'],
    meds: ['Healthcare', 'Medicine'],
    osudh: ['Healthcare', 'Medicine'],
    oshudh: ['Healthcare', 'Medicine'],
    osud: ['Healthcare', 'Medicine'],
    'ওষুধ': ['Healthcare', 'Medicine'],
    'ঔষধ': ['Healthcare', 'Medicine'],
    napa: ['Healthcare', 'Medicine'],
    'নাপা': ['Healthcare', 'Medicine'],
    paracetamol: ['Healthcare', 'Medicine'],
    antibiotic: ['Healthcare', 'Medicine'],
    tablet: ['Healthcare', 'Medicine'],
    syrup: ['Healthcare', 'Medicine'],
    vitamin: ['Healthcare', 'Medicine'],
    doctor: ['Healthcare', 'Doctor Visit'],
    'ডাক্তার': ['Healthcare', 'Doctor Visit'],
    checkup: ['Healthcare', 'Doctor Visit'],
    pharmacy: ['Healthcare', 'Pharmacy'],
    'ফার্মেসি': ['Healthcare', 'Pharmacy'],
    gym: ['Healthcare', 'Gym/Fitness'],
    dentist: ['Healthcare', 'Dental'],
    hospital: ['Healthcare', null],
    'হাসপাতাল': ['Healthcare', null],
    clinic: ['Healthcare', null],
    'ক্লিনিক': ['Healthcare', null],
    // entertainment
    movie: ['Entertainment', 'Movies'],
    'মুভি': ['Entertainment', 'Movies'],
    cinema: ['Entertainment', 'Movies'],
    'সিনেমা': ['Entertainment', 'Movies'],
    game: ['Entertainment', 'Games'],
    netflix: ['Entertainment', 'Streaming Services'],
    'নেটফ্লিক্স': ['Entertainment', 'Streaming Services'],
    spotify: ['Entertainment', 'Streaming Services'],
    hoichoi: ['Entertainment', 'Streaming Services'],
    chorki: ['Entertainment', 'Streaming Services'],
    youtube: ['Entertainment', 'Streaming Services'],
    cricket: ['Entertainment', 'Sports'],
    football: ['Entertainment', 'Sports'],
    // shopping
    shirt: ['Shopping', 'Clothes'],
    'জামা': ['Shopping', 'Clothes'],
    'শার্ট': ['Shopping', 'Clothes'],
    'প্যান্ট': ['Shopping', 'Clothes'],
    shoe: ['Shopping', 'Clothes'],
    'জুতা': ['Shopping', 'Clothes'],
    dress: ['Shopping', 'Clothes'],
    panjabi: ['Shopping', 'Clothes'],
    'পাঞ্জাবি': ['Shopping', 'Clothes'],
    saree: ['Shopping', 'Clothes'],
    'শাড়ি': ['Shopping', 'Clothes'],
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
    daraz: ['Shopping', 'Online Shopping'],
    detergent: ['Shopping', 'Home & Garden'],
    tissue: ['Shopping', 'Home & Garden'],
    bulb: ['Shopping', 'Home & Garden'],
    watch: ['Shopping', null],
    bag: ['Shopping', null],
    // education
    book: ['Education', 'Books'],
    boi: ['Education', 'Books'],
    'বই': ['Education', 'Books'],
    notebook: ['Education', 'Supplies'],
    khata: ['Education', 'Supplies'],
    'খাতা': ['Education', 'Supplies'],
    pen: ['Education', 'Supplies'],
    'কলম': ['Education', 'Supplies'],
    pencil: ['Education', 'Supplies'],
    tuition: ['Education', 'Tuition'],
    'টিউশন': ['Education', 'Tuition'],
    udemy: ['Education', 'Courses'],
    coursera: ['Education', 'Courses'],
    school: ['Education', null],
    'স্কুল': ['Education', null],
    college: ['Education', null],
    'কলেজ': ['Education', null],
    university: ['Education', null],
    exam: ['Education', null],
    // personal care
    haircut: ['Personal Care', 'Haircut'],
    salon: ['Personal Care', 'Haircut'],
    'সেলুন': ['Personal Care', 'Haircut'],
    barber: ['Personal Care', 'Haircut'],
    facial: ['Personal Care', 'Spa/Massage'],
    lipstick: ['Personal Care', 'Cosmetics'],
    shampoo: ['Personal Care', null],
    'শ্যাম্পু': ['Personal Care', null],
    soap: ['Personal Care', null],
    sabun: ['Personal Care', null],
    'সাবান': ['Personal Care', null],
    shaving: ['Personal Care', null],
    shave: ['Personal Care', null],
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
    stipend: ['Income', 'Salary'],
    beton: ['Income', 'Salary'],
    'বেতন': ['Income', 'Salary'],
    'বোনাস': ['Income', 'Salary']
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

    // First pass — per segment: date, then run-on pair split, then amounts.
    // A date word applies to every pair born from its segment.
    const parts = [];
    let datedSegments = 0;
    let segmentDate = null;
    for (const raw of segments) {
        const d = extractDate(raw, todayStr);
        if (d.date) { datedSegments++; segmentDate = d.date; }
        for (const piece of pairSplit(d.cleaned)) {
            const a = extractAmount(piece);
            parts.push({
                raw: piece, date: d.date, approx: !!d.approx,
                cleaned: a.cleaned, amount: a.amount, currency: a.currency,
                negative: a.negative
            });
        }
    }

    // Exactly one explicit date in the whole message → applies to every entry
    // ("lunch 150, rickshaw 40, tea 20 yesterday"). Per-segment dates override.
    const sharedDate = datedSegments === 1 ? segmentDate : null;

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
            // Conflicting signals: income wording around an expense-category
            // word ("sold old phone 3500", "tuition theke 5000 pelam") — the
            // sale/earning reading and the spending reading disagree, so ask.
            if (incomeIntent && !isIncomeCategory(category)) needsReview = true;
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
        if (p.negative || p.approx) needsReview = true;

        const date = p.date || sharedDate || todayStr;
        if (date > todayStr) needsReview = true; // future date — trusted but flagged

        if (needsReview && confidence === 'high') confidence = 'medium';

        entries.push({
            date,
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

/** NFC; Bengali digits → ASCII; curated typo fixes; spoken number words →
 *  digits ("পঞ্চাশ টাকা" → "50 টাকা", "dui hajar" → "2000"); "50k" → "50000". */
export function normalize(text) {
    let t = String(text).normalize('NFC');
    t = t.replace(/[০-৯]/g, ch => BN_DIGITS[ch] || ch);
    t = t.replace(/[A-Za-z]+/g, w => TYPOS[w.toLowerCase()] || w);
    t = wordsToNumber(t);
    t = t.replace(/\b(\d+(?:\.\d+)?)\s*k\b/gi, (_, n) => String(Math.round(parseFloat(n) * 1000)));
    return t;
}

// Spoken amounts, three vocabularies: English, Latin Banglish, Bengali script.
// bn-BD dictation writes "পঞ্চাশ টাকা", not "৫০". Additive values; Latin "at" (8)
// is deliberately absent — it's an English word ("at 3" is a time).
const NUM_UNITS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
    eighty: 80, ninety: 90,
    ek: 1, dui: 2, tin: 3, char: 4, pach: 5, panch: 5, choy: 6, chhoy: 6,
    sat: 7, noy: 9, dosh: 10, bish: 20, kuri: 20, trish: 30, chollish: 40,
    ponchash: 50, shat: 60, shait: 60, shottor: 70, ashi: 80, nobboi: 90,
    'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'সাত': 7,
    'আট': 8, 'নয়': 9, 'দশ': 10, 'বিশ': 20, 'কুড়ি': 20, 'ত্রিশ': 30,
    'চল্লিশ': 40, 'পঞ্চাশ': 50, 'ষাট': 60, 'সত্তর': 70, 'আশি': 80, 'নব্বই': 90,
    // hundred-compounds written as one token
    eksho: 100, duisho: 200, tinsho: 300, charsho: 400, pachsho: 500,
    panchsho: 500, choysho: 600, chhoysho: 600, satsho: 700, atsho: 800, noysho: 900,
    'একশ': 100, 'একশো': 100, 'দুইশ': 200, 'দুইশো': 200, 'তিনশ': 300, 'তিনশো': 300,
    'চারশ': 400, 'চারশো': 400, 'পাঁচশ': 500, 'পাঁচশো': 500, 'ছয়শ': 600, 'ছয়শো': 600,
    'সাতশ': 700, 'সাতশো': 700, 'আটশ': 800, 'আটশো': 800, 'নয়শ': 900, 'নয়শো': 900
};
const NUM_MULTS = {
    hundred: 100, sho: 100, shoto: 100, 'শ': 100, 'শো': 100, 'শত': 100,
    thousand: 1000, hajar: 1000, hazar: 1000, 'হাজার': 1000,
    lakh: 100000, lac: 100000, 'লাখ': 100000, 'লক্ষ': 100000
};
const NUM_U = new Map(Object.entries(NUM_UNITS).map(([k, v]) => [k.normalize('NFC'), v]));
const NUM_M = new Map(Object.entries(NUM_MULTS).map(([k, v]) => [k.normalize('NFC'), v]));

/**
 * Replace maximal runs of spoken-number words with digits. A lone small unit
 * stays a word ("one coffee" is not amount 1) — a run converts only when it
 * has 2+ words or reaches 10 ("fifty", "পাঁচশো", "dui hajar").
 */
function wordsToNumber(text) {
    const parts = text.split(/(\s+)/);
    const out = [];
    let runOrig = '', cur = 0, total = 0, count = 0, tail = '', pendingSep = '';

    const flush = () => {
        if (count) {
            const value = total + cur;
            out.push((count > 1 || value >= 10) ? String(value) + tail : runOrig);
        }
        runOrig = ''; cur = 0; total = 0; count = 0; tail = '';
    };

    for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
            if (count) pendingSep += part;
            else out.push(part);
            continue;
        }
        const m = /^(.*?)([.,;:!?]*)$/.exec(part);
        const core = m[1].normalize('NFC').toLowerCase();
        const u = NUM_U.get(core), mult = NUM_M.get(core);
        if (u != null || mult != null) {
            runOrig += pendingSep + part;
            pendingSep = '';
            if (u != null) cur += u;
            else if (mult >= 1000) { total += (cur || 1) * mult; cur = 0; }
            else cur = (cur || 1) * mult;
            count++;
            if (m[2]) { tail = m[2]; flush(); }
            continue;
        }
        flush();
        if (pendingSep) { out.push(pendingSep); pendingSep = ''; }
        out.push(part);
    }
    flush();
    if (pendingSep) out.push(pendingSep);
    return out.join('');
}

/**
 * Split a message into transaction candidates. Thousand-separator commas are
 * collapsed first ("1,200" → "1200") using a lookahead — no regex lookbehind
 * (unsupported on Safari <16.4). Connectors: "and", the typo "nd", Banglish
 * "ar"/"ebong", Bengali "এবং"/"আর". A connector chunk without any number is
 * glued back to its neighbour, so "lunch and coffee for 450" stays one entry
 * while "groceries 500 and fish 350" splits.
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
    const chunks = part.split(/\b(?:and|nd|ebong|ar)\b|এবং|আর/i);
    if (chunks.length < 2) return [part];
    // Digit-less chunks are descriptions, not transactions — merge them into
    // the next chunk (or the previous one at the end of the line).
    const out = [];
    let carry = '';
    for (const c of chunks) {
        const merged = carry ? `${carry} ${c}` : c;
        if (/\d/.test(merged)) { out.push(merged); carry = ''; }
        else carry = merged;
    }
    if (carry.trim()) {
        if (out.length) out[out.length - 1] += ` ${carry}`;
        else out.push(carry);
    }
    return out;
}

/**
 * Split ONE segment holding several run-on transactions into candidate
 * pieces: "50 banna 50 riksha" → ["50 banna", "50 riksha"];
 * "lunch 150 rickshaw 40 tea 20" → three pieces. Orientation is detected per
 * group (amount-first vs item-first); quantity numbers ("2 kg", "40 people")
 * and lone leading verbs don't count as amounts. Segments with fewer than two
 * real amounts pass through untouched.
 */
export function pairSplit(text) {
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return [text];

    const bare = tokens.map(t => t.replace(/^[({[]+|[)}\].,;:!?]+$/g, ''));
    const isAmount = tokens.map((_, i) => {
        if (!/^[-৳$£€₹¥]?\d+(?:\.\d+)?$/.test(bare[i])) return false;
        if (i > 0 && bare[i - 1].toLowerCase() === 'at') return false; // "at 3" — a time
        const next = bare[i + 1];
        return !(next && UNIT_WORDS.has(fold(next))); // "2 kg" — quantity
    });

    // A small bare integer at an item boundary, followed by an item word and
    // then a LARGER price, is a quantity — not a price ("2 jackfruit 200" = two
    // jackfruit for 200, exactly like the glued "2kg doi 540"). Guards keep
    // amount-first run-ons ("banana 50 rickshaw 40") and genuine small
    // back-to-back prices ("tea 5 pan 5") intact: the count must be ≤ 20, start
    // a group (line start or right after a previous item's price), be followed
    // by a word, and have a strictly larger amount after it to serve as the price.
    const QTY_MAX = 20;
    const nextAmountValue = (from) => {
        for (let j = from; j < tokens.length; j++) {
            if (isAmount[j]) return Number(bare[j].replace(/^[-৳$£€₹¥]/, ''));
        }
        return null;
    };
    isAmount.forEach((v, i) => {
        if (!v || !/^\d+$/.test(bare[i]) || Number(bare[i]) > QTY_MAX) return;
        const atBoundary = i === 0 || isAmount[i - 1];
        const nextWord = bare[i + 1];
        if (!atBoundary || !nextWord || isAmount[i + 1] || !/\p{L}/u.test(nextWord)) return;
        const price = nextAmountValue(i + 1);
        if (price != null && price > Number(bare[i])) isAmount[i] = false;
    });

    const idxs = [];
    isAmount.forEach((v, i) => v && idxs.push(i));
    if (idxs.length < 2) return [text];

    // "bought 2 shirts 1600" — a small count right after the leading verb plus
    // a bare trailing price reads as ONE purchase of N items, not two entries.
    if (idxs.length === 2 && idxs[1] === tokens.length - 1 && idxs[1] > idxs[0] + 1) {
        let lead = 0;
        while (lead < idxs[0] && LEAD_VERBS.has(fold(bare[lead]))) lead++;
        if (lead === idxs[0] && Number(bare[idxs[0]].replace(/^[-৳$£€₹¥]/, '')) <= 12) {
            return [text];
        }
    }

    const amountAhead = (from) => {
        for (let j = from; j < tokens.length; j++) if (isAmount[j]) return true;
        return false;
    };

    const groups = [];
    let i = 0;
    while (i < tokens.length) {
        const group = [];
        // Peek past leading verbs to decide this group's orientation.
        let j = i;
        while (j < tokens.length && !isAmount[j] && LEAD_VERBS.has(fold(bare[j]))) j++;
        if (j < tokens.length && isAmount[j]) {
            // amount-first: verbs + the amount + trailing words up to the next amount
            while (i <= j) group.push(tokens[i++]);
            while (i < tokens.length && !isAmount[i]) group.push(tokens[i++]);
        } else {
            // item-first: words + one amount; absorb a tail only when no
            // further amount exists ("lunch 150 extra spicy" stays whole)
            while (i < tokens.length && !isAmount[i]) group.push(tokens[i++]);
            if (i < tokens.length) group.push(tokens[i++]);
            while (i < tokens.length && !isAmount[i] && !amountAhead(i)) group.push(tokens[i++]);
        }
        if (group.length) groups.push(group.join(' '));
    }
    return groups;
}

/**
 * Pull a date token out of the segment. Returns local YYYY-MM-DD or null;
 * `approx: true` marks a guessed date ("last month") the user should confirm.
 * @returns {{ date: string|null, cleaned: string, approx?: boolean }}
 */
export function extractDate(seg, todayStr) {
    const lit = seg.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (lit) return { date: normalizeDateString(lit[0]), cleaned: seg.replace(lit[0], ' ') };

    // "2 days ago" / Banglish "2 din age(y)" — must run before amount
    // extraction so the 2 can never be mistaken for the price.
    const rel = seg.match(/\b(\d+)\s*(?:days?\s+ago|din\s+ag(?:e|ey|ay))\b/i);
    if (rel) {
        return { date: dateFromToday(todayStr, Number(rel[1])), cleaned: seg.replace(rel[0], ' ') };
    }
    if (/\bday\s+before\s+yesterday\b/i.test(seg)) {
        return { date: dateFromToday(todayStr, 2), cleaned: seg.replace(/\bday\s+before\s+yesterday\b/gi, ' ') };
    }
    if (/\btoday\b|\bajke\b|আজকে/i.test(seg)) {
        return { date: todayStr, cleaned: seg.replace(/\btoday\b|\bajke\b|আজকে/gi, ' ') };
    }
    if (/\byesterday\b|\bgot(?:o)?kal\b|গতকাল/i.test(seg)) {
        return { date: dateFromToday(todayStr, 1), cleaned: seg.replace(/\byesterday\b|\bgot(?:o)?kal\b|গতকাল/gi, ' ') };
    }
    if (/\blast\s+month\b/i.test(seg)) {
        return { date: prevMonthDate(todayStr), cleaned: seg.replace(/\blast\s+month\b/gi, ' '), approx: true };
    }
    for (let dow = 0; dow < WEEKDAYS.length; dow++) {
        const re = new RegExp(`\\b(last\\s+)?${WEEKDAYS[dow]}\\b`, 'i');
        const m = seg.match(re);
        if (m) {
            let diff = (dowOf(todayStr) - dow + 7) % 7; // 0 = today
            if (m[1] && diff === 0) diff = 7; // "last friday" is never today
            return {
                date: dateFromToday(todayStr, diff),
                cleaned: seg.replace(new RegExp(`\\b(?:last\\s+)?${WEEKDAYS[dow]}\\b`, 'gi'), ' ')
            };
        }
    }
    return { date: null, cleaned: seg };
}

/**
 * Last real number in the segment is the amount. Quantity numbers ("2 kg",
 * "40 people") are skipped; a leading minus flags the entry instead of being
 * silently dropped. Currency tokens are detected (for conflict flagging) and
 * stripped from the description.
 * @returns {{ amount: number|null, cleaned: string, currency: string|null, negative: boolean }}
 */
export function extractAmount(seg) {
    const currency = detectCurrency(seg);
    const matches = [...seg.matchAll(/\d+(?:\.\d+)?/g)].filter(m => {
        if (/\bat\s*$/i.test(seg.slice(0, m.index))) return false; // "at 3" — a time
        const after = seg.slice(m.index + m[0].length).match(/^\s*(\p{L}+)/u);
        return !(after && UNIT_WORDS.has(fold(after[1])));
    });
    if (!matches.length) return { amount: null, cleaned: seg, currency, negative: false };

    const m = matches[matches.length - 1];
    const amount = Number(m[0]);
    const before = seg.slice(0, m.index);
    const negative = /(?:^|[\s(])-$/.test(before);
    const cleaned = stripCurrencyTokens(seg.slice(0, m.index) + seg.slice(m.index + m[0].length));
    if (!Number.isFinite(amount) || amount <= 0) return { amount: null, cleaned, currency, negative };
    return { amount, cleaned, currency, negative };
}

function detectCurrency(seg) {
    const sym = seg.match(/[৳$£€₹¥]/);
    if (sym) return CURRENCY_SYMBOLS[sym[0]];
    if (/টাকা/.test(seg)) return 'BDT'; // bn-BD dictation writes the word out
    CURRENCY_WORD_RE.lastIndex = 0;
    const word = CURRENCY_WORD_RE.exec(seg);
    if (word) return CURRENCY_WORDS[word[1].toLowerCase()];
    return null;
}

function stripCurrencyTokens(s) {
    return s.replace(/[৳$£€₹¥-]/g, ' ').replace(/টাকা/g, ' ').replace(CURRENCY_WORD_RE, ' ');
}

/** NFC + case-fold + naive singular fold so "concert"/"Concerts" meet in the
 *  middle — and Bengali composed/decomposed forms ("য়" both ways) match. */
export function fold(w) {
    w = w.normalize('NFC').toLowerCase();
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
 * one folded phrase key for the bigram pass ("public transit"). A single word
 * taken from a multi-word category name ("bill") is marked fragment: true —
 * it loses to subcategory-level synonym/typo evidence at match time.
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
        const fragment = ws.length > 1 && !val.subcategory;
        for (const w of ws) putKey(w, fragment ? { ...val, fragment } : val);
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
    // \p{M} keeps combining marks (Bengali vowel signs, hasant) inside words:
    // without it "চা" would tokenize as "চ" and never match anything.
    return s.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

/**
 * Match a segment against: curated phrases, then the user's taxonomy
 * (bigrams before single words), then the learned index (this user's
 * accepted history), then the synonym pack, then the typo-tolerance pass.
 * A fragment hit (single word out of a multi-word category name) only wins
 * when no subcategory-level synonym/typo evidence exists.
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
            if (!catOnly || catOnly.fragment) catOnly = hit;
        }
    }

    // A solid category hit (the user typed the category's own name) wins over
    // the synonym pack. A fragment ("bill" out of "Bills & Utilities") waits
    // to see whether a subcategory-level synonym or typo match knows better.
    if (catOnly && !catOnly.fragment) {
        return { category: catOnly.category, subcategory: null, incomeAmbiguous: sawIncomeCollision };
    }

    let synHit = null;
    for (const w of words) {
        const syn = SYN.get(w);
        if (!syn) continue;
        const [cat, sub] = syn;
        if (!categories?.[cat]) continue; // user renamed/deleted it — no guess
        if (isIncomeCategory(cat) && !incomeIntent) { sawIncomeCollision = true; continue; }
        const subs = categories[cat].subcategories || [];
        const hit = { category: cat, subcategory: sub && subs.includes(sub) ? sub : null };
        if (hit.subcategory) { synHit = hit; break; }
        if (!synHit) synHit = hit;
    }
    if (synHit?.subcategory) {
        return { ...synHit, incomeAmbiguous: sawIncomeCollision };
    }

    const fuzzy = fuzzyMatch(words, index, categories, incomeIntent);
    if (fuzzy?.subcategory) {
        return { ...fuzzy, incomeAmbiguous: sawIncomeCollision };
    }

    if (catOnly) {
        return { category: catOnly.category, subcategory: null, incomeAmbiguous: sawIncomeCollision };
    }
    if (synHit) return { ...synHit, incomeAmbiguous: sawIncomeCollision };
    if (fuzzy) return { ...fuzzy, incomeAmbiguous: sawIncomeCollision };
    return null;
}

/**
 * Typo tolerance: a word (5+ letters, Latin only, not a common English word)
 * that is exactly one edit away from ONE known vocabulary target adopts that
 * target's mapping. Two competing targets → no guess.
 */
function fuzzyMatch(words, index, categories, incomeIntent) {
    for (const w of words) {
        if (w.length < 5 || FUZZY_SKIP.has(w) || !/^[a-z]+$/.test(w)) continue;
        const targets = new Map();
        for (const [key, [cat, sub]] of SYN) {
            if (key.includes(' ') || !editDistance1(w, key)) continue;
            if (!categories?.[cat]) continue;
            if (isIncomeCategory(cat) && !incomeIntent) continue;
            const subs = categories[cat].subcategories || [];
            const s = sub && subs.includes(sub) ? sub : null;
            targets.set(`${cat}›${s || ''}`, { category: cat, subcategory: s });
        }
        for (const [key, slots] of index) {
            if (key.includes(' ') || !editDistance1(w, key)) continue;
            const hit = incomeIntent && slots.income ? slots.income : slots.expense;
            if (!hit || hit.fragment) continue;
            targets.set(`${hit.category}›${hit.subcategory || ''}`,
                { category: hit.category, subcategory: hit.subcategory || null });
        }
        if (targets.size === 1) return targets.values().next().value;
    }
    return null;
}

/** True when a and b are within one edit (sub, adjacent swap, insert, delete). */
function editDistance1(a, b) {
    if (a === b) return false; // exact matches are someone else's job
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la === lb) {
        const diffs = [];
        for (let i = 0; i < la && diffs.length <= 2; i++) if (a[i] !== b[i]) diffs.push(i);
        if (diffs.length === 1) return true;
        return diffs.length === 2 && diffs[1] === diffs[0] + 1 &&
            a[diffs[0]] === b[diffs[1]] && a[diffs[1]] === b[diffs[0]];
    }
    const [s, l] = la < lb ? [a, b] : [b, a];
    let i = 0, j = 0, skipped = false;
    while (i < s.length && j < l.length) {
        if (s[i] === l[j]) { i++; j++; }
        else if (skipped) return false;
        else { skipped = true; j++; }
    }
    return true;
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

function prevMonthDate(todayStr) {
    const [y, m, d] = todayStr.split('-').map(Number);
    const daysInPrev = new Date(y, m - 1, 0).getDate();
    return getLocalDateString(new Date(y, m - 2, Math.min(d, daysInPrev)));
}
