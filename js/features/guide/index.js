// js/features/guide/index.js
// Assistant Guide — a self-documenting help page + live learning dashboard for
// XpenseBot / the quick-capture box. Both surfaces share one engine (parser.js),
// so this page documents that one engine.
//
// Two halves, both live:
//   1. "What you can type" — each example is run through the REAL parse() with
//      the user's own categories, so the shown output can never drift from what
//      the parser actually does.
//   2. "What it has learned about you" — reads the on-device learned index and
//      audit log (learnedSummary + logStats). The "still guessing" list reuses
//      the same create-subcategory action the capture box and chat use.
//
// Read-only except for the create/dismiss subcategory actions. No store writes
// beyond addSubcategory; nothing here is synced to the cloud sheet.

import { $, on, delegate, el } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { getLocalDateString, formatCurrency } from '../../core/format.js';
import { navigateTo } from '../navigation/index.js';
import { parse } from '../assistant/parser.js';
import { getLearnedLookup, learnedSummary, acceptSuggestion, dismissSuggestion } from '../assistant/learned.js';
import { logStats } from '../assistant/audit-log.js';
import { isIncomeCategory } from '../categories/categories.model.js';
import { addSubcategory } from '../categories/actions.js';

let pageEl;

// Each capability lists example inputs; render() runs them through parse() live.
const CAPABILITIES = [
    {
        icon: '🧾', title: 'Several things at once',
        desc: 'Separate a whole day with commas — each becomes its own entry.',
        examples: ['breakfast 120, rickshaw 50, tea 20']
    },
    {
        icon: '📅', title: 'Dates in plain words',
        desc: '“yesterday”, “2 days ago”, “last friday”, “last month”. One date word covers the whole line.',
        examples: ['lunch 150, coffee 40 yesterday', 'groceries 500 2 days ago']
    },
    {
        icon: '💰', title: 'Income, not just spending',
        desc: 'Tell it you got paid and it logs the entry as income.',
        examples: ['got paid 20k', 'freelance payment 15000']
    },
    {
        icon: '🇧🇩', title: 'Bangla & Banglish',
        desc: 'Type in Bangla script or romanised Bangla — words and digits both work.',
        examples: ['রিকশা ৫০, দুপুরের খাবার ৩০০', 'dui hajar taka bazar']
    },
    {
        icon: '🔢', title: 'Numbers in words & shorthand',
        desc: '“fifty”, “পঞ্চাশ”, and “50k” all turn into amounts.',
        examples: ['fifty taka cha', 'phone recharge 2k']
    },
    {
        icon: '💱', title: 'Currencies',
        desc: 'Symbols and words are understood; a currency different from your default gets flagged.',
        examples: ['coffee $4', 'bazar 800 taka']
    },
    {
        icon: '✍️', title: 'Typos',
        desc: 'Close-enough spellings still land in the right place.',
        examples: ['riksha 40, medisin 250']
    },
    {
        icon: '🏪', title: 'Brands & shops it knows',
        desc: 'Local and global names file where they belong — foodpanda, pathao, daraz, netflix, agora and more.',
        examples: ['foodpanda 450, netflix 300', 'daraz 1200']
    },
    {
        icon: '⚖️', title: 'Quantities aren’t prices',
        desc: 'It knows “2 kg” or “40 people” is a count, not a cost — the real amount wins.',
        examples: ['2 kg chal 140', 'iftar for 40 people 3000']
    }
];

// When the parser flags an entry with ⚠ instead of guessing silently.
const REVIEW_TRIGGERS = [
    ['🤷', 'Unknown item', 'Nothing matched, so it fell back to your “Other” category for you to correct.'],
    ['⛽', 'A genuinely ambiguous word', 'Bare “gas” could be cooking gas or vehicle fuel — it asks rather than guess.'],
    ['↩️', 'Money that isn’t a plain expense', 'Refund, transfer, loan, or credit-card payment — the meaning is yours to confirm.'],
    ['💱', 'A different currency', 'The amount used a currency other than your default.'],
    ['🗓️', 'An odd date', 'A future date or an approximate one like “last month”.'],
    ['🔁', 'Mixed signals', 'Income wording sitting next to a spending word (“sold old phone”).']
];

// Honest “not yet” list — sets expectations. Pro (LLM) mode covers more of these.
const LIMITS = [
    ['One shared amount', '“lunch and coffee for 450” stays a single entry — it won’t split 450 for you.'],
    ['Billing-period dates', '“rent for July” is dated today, with “for July” kept in the note.'],
    ['Refund vs transfer vs loan', 'It flags these but leaves the accounting call to you.'],
    ['Fixing an entry by chatting', '“actually it was 450” makes a new entry — edit the original instead.']
];

export function mount() {
    pageEl = $('.nav-page[data-page="guide"]');
    if (!pageEl) return;

    render();

    // The learned index and audit log are localStorage, not the store, so
    // re-render every time the user opens the Guide tab to show fresh data.
    const navItem = $('#bottom-nav .nav-item[data-page="guide"]');
    if (navItem) on(navItem, 'click', render);

    // Contextual entry point from the quick-capture box.
    const link = $('#capture-guide-link');
    if (link) on(link, 'click', ev => { ev.preventDefault(); navigateTo('guide'); render(); });

    delegate(pageEl, 'click', '[data-role="guide-create"]', onCreate);
    delegate(pageEl, 'click', '[data-role="guide-dismiss"]', onDismiss);
}

function render() {
    if (!pageEl) return;
    const s = store.getState();
    pageEl.replaceChildren(
        headerNode(),
        capabilitiesSection(s.categories, s.settings?.currency),
        learningSection(s.categories),
        reviewSection(),
        limitsSection()
    );
}

// ---- header ----------------------------------------------------------------

function headerNode() {
    return el('header', { class: 'guide-header' },
        el('h2', { class: 'section-title' },
            el('span', { class: 'title-icon' }, '🤖'), ' Assistant Guide'),
        el('p', { class: 'guide-sub' },
            'How XpenseBot reads what you type, when it double-checks with you, and what it has learned from you. Everything here runs on your device — your text never leaves this browser.')
    );
}

// ---- section 1: capabilities (live examples) -------------------------------

function capabilitiesSection(categories, currency) {
    const cards = CAPABILITIES.map(cap =>
        el('div', { class: 'guide-cap' },
            el('div', { class: 'guide-cap-head' },
                el('span', { class: 'guide-cap-icon' }, cap.icon),
                el('span', { class: 'guide-cap-title' }, cap.title)),
            el('p', { class: 'guide-cap-desc' }, cap.desc),
            ...cap.examples.map(text => exampleNode(text, categories, currency))
        )
    );
    return el('section', { class: 'guide-section' },
        el('h3', { class: 'guide-h3' }, 'What you can type'),
        el('p', { class: 'guide-lead' }, 'Type it the way you’d say it. These examples are run through the real parser as this page loads:'),
        el('div', { class: 'guide-cap-grid' }, ...cards),
        el('p', { class: 'guide-legend' },
            'A ', el('span', { class: 'guide-chip guide-chip-review' }, 'flagged ⚠'),
            ' entry still saves — the ⚠ just means “worth a glance”. ',
            el('span', { class: 'guide-chip guide-chip-income' }, 'Income'), ' rows are shown in green.')
    );
}

function exampleNode(text, categories, currency) {
    const { entries, unmatched } = parse(text, {
        categories,
        todayStr: getLocalDateString(new Date()),
        currencyCode: currency,
        learned: getLearnedLookup(categories)
    });
    const out = el('div', { class: 'guide-ex-out' },
        ...entries.map(e => chipNode(e, currency)));
    if (unmatched.length) {
        out.append(el('span', { class: 'guide-chip guide-chip-unread' },
            `couldn’t read: ${unmatched.join(', ')}`));
    }
    return el('div', { class: 'guide-ex' },
        el('code', { class: 'guide-ex-in' }, text),
        el('span', { class: 'guide-ex-arrow', 'aria-hidden': 'true' }, '→'),
        out
    );
}

function chipNode(e, currency) {
    const income = isIncomeCategory(e.category);
    const cls = 'guide-chip'
        + (e.needsReview ? ' guide-chip-review' : '')
        + (income ? ' guide-chip-income' : '');
    return el('span', { class: cls },
        `${e.category} › ${e.subcategory} · ${formatCurrency(e.amount, currency)}${e.needsReview ? ' ⚠' : ''}`);
}

// ---- section 2: learning dashboard (live) ----------------------------------

function learningSection(categories) {
    const sum = learnedSummary(categories);
    const stats = logStats();

    const tiles = el('div', { class: 'guide-stats' },
        statTile('Entries logged', stats.entriesAccepted, 'via the assistant recently'),
        statTile('Double-checks', stats.flagged, 'flagged with ⚠'),
        statTile('Words learned', sum.trusted.length, 'auto-filed for you'),
        statTile('Still guessing', sum.misses.length, 'could become subcategories')
    );

    return el('section', { class: 'guide-section' },
        el('h3', { class: 'guide-h3' }, 'What it has learned about you'),
        el('p', { class: 'guide-lead' }, 'XpenseBot gets more accurate the more you use it. It never invents a new top-level category — it only learns to file words under the categories you already have, and forgets words you stop using.'),
        tiles,
        learnedBlock(sum),
        missesBlock(sum)
    );
}

function statTile(label, value, sub) {
    return el('div', { class: 'guide-stat' },
        el('span', { class: 'guide-stat-value' }, String(value)),
        el('span', { class: 'guide-stat-label' }, label),
        el('span', { class: 'guide-stat-sub' }, sub)
    );
}

function learnedBlock(sum) {
    const block = el('div', { class: 'guide-sub-block' },
        el('h4', { class: 'guide-h4' }, 'Words it files automatically'));
    if (!sum.trusted.length) {
        block.append(el('p', { class: 'guide-empty' },
            'Nothing yet. Once you log the same kind of thing a couple of times, XpenseBot starts filing it here without asking.'));
        return block;
    }
    block.append(el('div', { class: 'guide-learned' },
        ...sum.trusted.map(w => el('span', { class: 'guide-learned-chip' },
            el('strong', {}, w.word), ' → ',
            `${w.category}${w.subcategory ? ' › ' + w.subcategory : ''}`,
            el('span', { class: 'guide-learned-count' }, `×${w.count}`)
        ))
    ));
    return block;
}

function missesBlock(sum) {
    const block = el('div', { class: 'guide-sub-block' },
        el('h4', { class: 'guide-h4' }, 'Words it keeps guessing on'));
    if (!sum.misses.length) {
        block.append(el('p', { class: 'guide-empty' },
            'Nothing pending. When a word keeps landing in the wrong place, it’ll show up here so you can give it a home.'));
        return block;
    }
    block.append(el('p', { class: 'guide-lead' },
        'These keep falling back to a default. Give one its own subcategory and XpenseBot will file it there from now on:'));
    block.append(el('div', { class: 'guide-misses' },
        ...sum.misses.map(m => el('div', { class: 'guide-miss' + (m.ready ? ' guide-miss-ready' : '') },
            el('span', { class: 'guide-miss-word' },
                el('strong', {}, m.word),
                el('span', { class: 'guide-miss-meta' }, `seen ${m.count}× · would go under ${m.category}`)),
            el('div', { class: 'guide-miss-actions' },
                el('button', {
                    class: 'guide-btn guide-btn-create',
                    dataset: { role: 'guide-create', word: m.word, label: m.label, category: m.category }
                }, `✓ Create “${m.label}”`),
                el('button', {
                    class: 'guide-btn guide-btn-dismiss',
                    dataset: { role: 'guide-dismiss', word: m.word }
                }, 'Ignore'))
        ))
    ));
    return block;
}

// ---- section 3: review triggers --------------------------------------------

function reviewSection() {
    return el('section', { class: 'guide-section' },
        el('h3', { class: 'guide-h3' }, 'When it asks you to check (⚠)'),
        el('p', { class: 'guide-lead' }, 'XpenseBot never guesses silently. When it’s unsure it still saves the entry, but marks it ⚠ so you can fix it in one tap:'),
        el('ul', { class: 'guide-list' },
            ...REVIEW_TRIGGERS.map(([icon, title, desc]) =>
                el('li', { class: 'guide-list-item' },
                    el('span', { class: 'guide-list-icon' }, icon),
                    el('span', {},
                        el('strong', {}, title), ' — ', desc)))
        )
    );
}

// ---- section 4: limits -----------------------------------------------------

function limitsSection() {
    return el('section', { class: 'guide-section' },
        el('h3', { class: 'guide-h3' }, 'What it can’t do yet'),
        el('p', { class: 'guide-lead' }, 'The free parser is rules-based and honest about its edges. These need judgement it doesn’t have — adding an API key in Settings → Assistant unlocks the smarter Pro mode for many of them:'),
        el('ul', { class: 'guide-list' },
            ...LIMITS.map(([title, desc]) =>
                el('li', { class: 'guide-list-item' },
                    el('span', { class: 'guide-list-icon' }, '•'),
                    el('span', {}, el('strong', {}, title), ' — ', desc)))
        )
    );
}

// ---- actions ---------------------------------------------------------------

function onCreate(_ev, btn) {
    const { word, label, category } = /** @type {HTMLElement} */ (btn).dataset;
    const res = addSubcategory(category, label);
    if (!res.ok && res.error !== 'Subcategory already exists') return;
    acceptSuggestion(word, category, label);
    render();
}

function onDismiss(_ev, btn) {
    dismissSuggestion(/** @type {HTMLElement} */ (btn).dataset.word);
    render();
}
