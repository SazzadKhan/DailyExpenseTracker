// js/features/assistant/learned.js
// Personal knowledge layer for the parser: learns word → category›subcategory
// from the user's own confirmed entries, and tracks recurring unknown words so
// the bot can suggest creating a new subcategory for them.
//
// Two separate stores, on purpose:
//   words  — learned from entries the parser matched (confidence high/medium)
//            and the user accepted. Reinforces real knowledge.
//   misses — words from fallback entries (confidence low). The category there
//            is a default, not user intent, so they teach nothing about
//            classification — but a word that keeps missing is exactly what
//            deserves a "create a subcategory?" suggestion.
//
// Pure core (…In functions take the data object) + thin localStorage wrapper,
// same split as audit-log.js. Local-only; never synced to the cloud sheet.

import { STORAGE_KEYS } from '../../core/constants.js';
import { getLocalDateString } from '../../core/format.js';
import { isIncomeCategory, subcategoriesOf } from '../categories/categories.model.js';
import { foldWords } from './parser.js';

/** A learned mapping needs this many accepts before the parser trusts it. */
export const MIN_LEARN_COUNT = 2;
/** A miss word must recur this often inside the window to earn a suggestion. */
export const SUGGEST_MIN = 3;
export const SUGGEST_WINDOW_DAYS = 30;
/** Counts halve when the data is older than this — old habits fade. */
const DECAY_DAYS = 30;
/** Seed count for a mapping created by an accepted suggestion. */
const SEED_COUNT = 5;

const MAX_WORDS = 500;
const MAX_TARGETS_PER_WORD = 5;
const MAX_COUNT = 100;
const MAX_MISSES = 100;
const MAX_MISS_DATES = 10;

// Filler that carries no category meaning — never learn or suggest these.
const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'was', 'were', 'got', 'had', 'has',
    'have', 'this', 'that', 'other', 'misc', 'miscellaneou', 'today',
    'yesterday', 'bought', 'buy', 'paid', 'pay', 'per', 'off', 'out', 'new',
    'old', 'some', 'more', 'bill', 'fee', 'cost', 'total'
]);

function learnableWords(text) {
    return foldWords(String(text || '')).filter(w =>
        w.length >= 3 && !/^\d+$/.test(w) && !STOPWORDS.has(w));
}

export function emptyLearned(todayStr) {
    return { words: {}, misses: {}, dismissed: {}, decayedAt: todayStr || null };
}

/** Days between two local YYYY-MM-DD strings (b - a). */
function dayDiff(a, b) {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
}

/**
 * Record what the user just accepted. Matched entries reinforce the word
 * index; fallback entries feed the miss tracker. Mutates `data` in place.
 * @param {object} data learned data object
 * @param {Array<{category:string, subcategory:string, description:string,
 *                confidence:'high'|'medium'|'low'}>} entries accepted entries
 * @param {string} todayStr local YYYY-MM-DD
 */
export function recordOutcomeIn(data, entries, todayStr) {
    for (const e of entries || []) {
        const words = learnableWords(e?.description);
        if (!words.length) continue;

        if (e.confidence === 'low') {
            for (const w of words) recordMiss(data, w, e.category, todayStr);
        } else {
            const target = `${e.category}›${e.subcategory}`;
            for (const w of words) recordWord(data, w, target);
        }
    }
    return data;
}

function recordWord(data, word, target) {
    const entry = data.words[word] || {};
    if (!(target in entry) && Object.keys(entry).length >= MAX_TARGETS_PER_WORD) return;
    if (!data.words[word] && Object.keys(data.words).length >= MAX_WORDS) return;
    entry[target] = Math.min((entry[target] || 0) + 1, MAX_COUNT);
    data.words[word] = entry;
}

function recordMiss(data, word, category, todayStr) {
    if (data.dismissed[word]) return;
    const miss = data.misses[word] || { dates: [], category };
    if (!data.misses[word] && Object.keys(data.misses).length >= MAX_MISSES) return;
    if (miss.dates[miss.dates.length - 1] !== todayStr) {
        miss.dates.push(todayStr);
        while (miss.dates.length > MAX_MISS_DATES) miss.dates.shift();
    }
    miss.category = category; // most recent landing spot wins
    data.misses[word] = miss;
}

/**
 * Build the lookup the parser consumes: folded word →
 * { category, subcategory|null, income }. Only mappings with enough accepts
 * and a still-existing category survive; a deleted subcategory degrades the
 * mapping to category-only rather than guessing.
 * @returns {Map<string, {category:string, subcategory:string|null, income:boolean}>}
 */
export function buildLearnedLookup(data, categories) {
    const map = new Map();
    for (const [word, targets] of Object.entries(data?.words || {})) {
        let best = null, bestCount = 0;
        for (const [target, count] of Object.entries(targets)) {
            if (count > bestCount) { best = target; bestCount = count; }
        }
        if (!best || bestCount < MIN_LEARN_COUNT) continue;

        const sep = best.indexOf('›');
        const category = best.slice(0, sep);
        let subcategory = best.slice(sep + 1) || null;
        if (!categories?.[category]) continue;
        if (subcategory && !subcategoriesOf(categories, category).includes(subcategory)) {
            subcategory = null;
        }
        map.set(word, { category, subcategory, income: isIncomeCategory(category) });
    }
    return map;
}

/**
 * The single best "create a subcategory?" candidate, or null.
 * A word qualifies when it missed ≥ SUGGEST_MIN distinct days inside the
 * window, wasn't dismissed, its landing category still exists, and the
 * would-be subcategory doesn't already exist.
 * @returns {{ word:string, label:string, category:string, count:number } | null}
 */
export function findSuggestion(data, categories, todayStr) {
    let best = null;
    for (const [word, miss] of Object.entries(data?.misses || {})) {
        if (data.dismissed?.[word]) continue;
        if (!categories?.[miss.category]) continue;
        const recent = miss.dates.filter(d => {
            const diff = dayDiff(d, todayStr);
            return diff >= 0 && diff <= SUGGEST_WINDOW_DAYS;
        }).length;
        if (recent < SUGGEST_MIN) continue;
        const label = titleCase(word);
        if (subcategoriesOf(categories, miss.category).includes(label)) continue;
        if (!best || recent > best.count) {
            best = { word, label, category: miss.category, count: recent };
        }
    }
    return best;
}

function titleCase(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Accepting a suggestion seeds the word index so the parser files the word
 * under the new subcategory immediately, and retires the miss entry.
 * Mutates `data`.
 */
export function acceptSuggestionIn(data, word, category, subcategory) {
    data.words[word] = { [`${category}›${subcategory}`]: SEED_COUNT };
    delete data.misses[word];
    return data;
}

/** Declining a suggestion silences that word for good. Mutates `data`. */
export function dismissSuggestionIn(data, word) {
    data.dismissed[word] = true;
    delete data.misses[word];
    return data;
}

/**
 * Halve word counts when the data is stale so a changed spending life
 * doesn't fight months-old habits; prune miss dates older than the window.
 * Mutates `data`.
 */
export function applyDecay(data, todayStr) {
    if (!data.decayedAt) { data.decayedAt = todayStr; return data; }
    if (dayDiff(data.decayedAt, todayStr) < DECAY_DAYS) return data;

    for (const [word, targets] of Object.entries(data.words)) {
        for (const [target, count] of Object.entries(targets)) {
            const halved = Math.floor(count / 2);
            if (halved > 0) targets[target] = halved;
            else delete targets[target];
        }
        if (!Object.keys(targets).length) delete data.words[word];
    }
    for (const [word, miss] of Object.entries(data.misses)) {
        miss.dates = miss.dates.filter(d => dayDiff(d, todayStr) <= SUGGEST_WINDOW_DAYS * 2);
        if (!miss.dates.length) delete data.misses[word];
    }
    data.decayedAt = todayStr;
    return data;
}

// ---- localStorage wrapper (best-effort, like audit-log.js) -----------------

export function loadLearned() {
    const todayStr = getLocalDateString(new Date());
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.ASSISTANT_LEARNED);
        const data = raw ? JSON.parse(raw) : null;
        if (!data || typeof data !== 'object') return emptyLearned(todayStr);
        data.words = data.words || {};
        data.misses = data.misses || {};
        data.dismissed = data.dismissed || {};
        return applyDecay(data, todayStr);
    } catch (_) {
        return emptyLearned(todayStr);
    }
}

function saveLearned(data) {
    try {
        localStorage.setItem(STORAGE_KEYS.ASSISTANT_LEARNED, JSON.stringify(data));
    } catch (_) { /* quota / storage unavailable — learning is best-effort */ }
}

/** Record accepted entries (both surfaces call this after a save/confirm). */
export function recordOutcome(entries) {
    const data = loadLearned();
    recordOutcomeIn(data, entries, getLocalDateString(new Date()));
    saveLearned(data);
}

/** The lookup to pass as `ctx.learned` into parse(). */
export function getLearnedLookup(categories) {
    return buildLearnedLookup(loadLearned(), categories);
}

/** Best pending "create a subcategory?" suggestion, or null. */
export function nextSuggestion(categories) {
    return findSuggestion(loadLearned(), categories, getLocalDateString(new Date()));
}

export function acceptSuggestion(word, category, subcategory) {
    saveLearned(acceptSuggestionIn(loadLearned(), word, category, subcategory));
}

export function dismissSuggestion(word) {
    saveLearned(dismissSuggestionIn(loadLearned(), word));
}
