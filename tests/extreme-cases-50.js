// tests/extreme-cases-50.js
// 50 limit-pushing input lines with gold expectations for the assistant
// parser. Shared by tests/extreme-50.html (live before/after page) and the
// headless scoring harness. Pure data + tiny date helpers — no imports.
//
// Gold policy mirrors the parser's own: for genuinely ambiguous money-talk
// (transfers, loans, refunds, bare amounts) the CORRECT answer is a flagged
// entry (review: true), not a confident guess. A case passes only when entry
// count, amounts, categories, and every specified sub/date/review flag match.

/** @typedef {{ amount:number, category?:string, sub?:string, review?:boolean,
 *              date?:string, daysAgo?:number, prevMonth?:boolean, lastWeekday?:number }} Gold */

export const CASES = [
    // ---- The headline pattern: amount-first, typos, run-on ----------------
    { id: 1, group: 'Amount-first, typos, run-on',
      input: '50 banna 50 riksha 50 100 got payement',
      note: 'The user\'s own example: amount-first pairs, three typos, a bare amount, and an income tail — all in one breath with zero separators.',
      expect: [
          { amount: 50, category: 'Food & Dining', sub: 'Groceries' },
          { amount: 50, category: 'Transportation', sub: 'Public Transit' },
          { amount: 50, category: 'Other', review: true },
          { amount: 100, category: 'Income', review: false }
      ] },
    { id: 2, group: 'Amount-first, typos, run-on',
      input: '2 kg chal 140',
      note: 'The 2 is a quantity, not a price — must not become the amount or split the line.',
      expect: [{ amount: 140, category: 'Food & Dining', sub: 'Groceries' }] },
    { id: 3, group: 'Amount-first, typos, run-on',
      input: '100 tea 40 bus',
      note: 'Two amount-first pairs, no separators.',
      expect: [
          { amount: 100, category: 'Food & Dining', sub: 'Coffee & Snacks' },
          { amount: 40, category: 'Transportation', sub: 'Public Transit' }
      ] },
    { id: 4, group: 'Amount-first, typos, run-on',
      input: 'riksha 35',
      note: 'Common BD spelling, edit distance 2 from "rickshaw".',
      expect: [{ amount: 35, category: 'Transportation', sub: 'Public Transit' }] },
    { id: 5, group: 'Amount-first, typos, run-on',
      input: 'grocarys 850',
      note: 'Misspelled + pluralised "groceries".',
      expect: [{ amount: 850, category: 'Food & Dining', sub: 'Groceries' }] },
    { id: 6, group: 'Amount-first, typos, run-on',
      input: 'lanch 220',
      note: '"lanch" must mean lunch, not the launch ferry.',
      expect: [{ amount: 220, category: 'Food & Dining', sub: 'Restaurants' }] },
    { id: 7, group: 'Amount-first, typos, run-on',
      input: 'coffe 150',
      note: 'One dropped letter.',
      expect: [{ amount: 150, category: 'Food & Dining', sub: 'Coffee & Snacks' }] },
    { id: 8, group: 'Amount-first, typos, run-on',
      input: 'medcine 90',
      note: 'Dropped "i" in medicine.',
      expect: [{ amount: 90, category: 'Healthcare', sub: 'Medicine' }] },
    { id: 9, group: 'Amount-first, typos, run-on',
      input: '50 taka chal 30 taka dal',
      note: 'Amount-first pairs with currency words in between.',
      expect: [
          { amount: 50, category: 'Food & Dining', sub: 'Groceries' },
          { amount: 30, category: 'Food & Dining', sub: 'Groceries' }
      ] },
    { id: 10, group: 'Amount-first, typos, run-on',
      input: 'petral 100',
      note: 'Misspelled petrol.',
      expect: [{ amount: 100, category: 'Transportation', sub: 'Fuel/Gas' }] },

    // ---- Run-on multi-entry without separators -----------------------------
    { id: 11, group: 'Run-on multi-entry',
      input: 'lunch 150 rickshaw 40 tea 20',
      note: 'Word-amount pairs with no commas at all.',
      expect: [
          { amount: 150, category: 'Food & Dining', sub: 'Restaurants' },
          { amount: 40, category: 'Transportation', sub: 'Public Transit' },
          { amount: 20, category: 'Food & Dining', sub: 'Coffee & Snacks' }
      ] },
    { id: 12, group: 'Run-on multi-entry',
      input: 'bus 30 cng 120 dinner 300 yesterday',
      note: 'Three run-on pairs sharing one trailing date word.',
      expect: [
          { amount: 30, category: 'Transportation', sub: 'Public Transit', daysAgo: 1 },
          { amount: 120, category: 'Transportation', sub: 'Uber/Lyft', daysAgo: 1 },
          { amount: 300, category: 'Food & Dining', sub: 'Restaurants', daysAgo: 1 }
      ] },
    { id: 13, group: 'Run-on multi-entry',
      input: '100 uber 250 groceries',
      note: 'Amount-first orientation for both pairs.',
      expect: [
          { amount: 100, category: 'Transportation', sub: 'Uber/Lyft' },
          { amount: 250, category: 'Food & Dining', sub: 'Groceries' }
      ] },
    { id: 14, group: 'Run-on multi-entry',
      input: 'breakfast 80 100 bus',
      note: 'Orientation flips mid-line: word-first pair, then amount-first pair.',
      expect: [
          { amount: 80, category: 'Food & Dining', sub: 'Restaurants' },
          { amount: 100, category: 'Transportation', sub: 'Public Transit' }
      ] },
    { id: 15, group: 'Run-on multi-entry',
      input: 'egg 120 milk 85 bread 60',
      note: 'Three grocery pairs, no separators.',
      expect: [
          { amount: 120, category: 'Food & Dining', sub: 'Groceries' },
          { amount: 85, category: 'Food & Dining', sub: 'Groceries' },
          { amount: 60, category: 'Food & Dining', sub: 'Groceries' }
      ] },
    { id: 16, group: 'Run-on multi-entry',
      input: 'spent 500 uber 300 coffee',
      note: 'Leading verb then amount-first pairs — 500 belongs to uber, 300 to coffee.',
      expect: [
          { amount: 500, category: 'Transportation', sub: 'Uber/Lyft' },
          { amount: 300, category: 'Food & Dining', sub: 'Coffee & Snacks' }
      ] },
    { id: 17, group: 'Run-on multi-entry',
      input: 'grocery 500 nd fish 350',
      note: '"nd" — a typo\'d "and" that must not block the split.',
      expect: [
          { amount: 500, category: 'Food & Dining', sub: 'Groceries' },
          { amount: 350, category: 'Food & Dining', sub: 'Groceries' }
      ] },

    // ---- Typos & fuzzy matching --------------------------------------------
    { id: 18, group: 'Typos & fuzzy',
      input: 'rikshaw 45',
      note: 'One dropped letter from rickshaw.',
      expect: [{ amount: 45, category: 'Transportation', sub: 'Public Transit' }] },
    { id: 19, group: 'Typos & fuzzy',
      input: 'electrisity bill 1400',
      note: 'Typo\'d electricity + the generic word "bill" — should land on the Electricity sub, not generic Bills.',
      expect: [{ amount: 1400, category: 'Bills & Utilities', sub: 'Electricity' }] },
    { id: 20, group: 'Typos & fuzzy',
      input: 'sallary 25000 received',
      note: 'Misspelled salary with explicit income wording.',
      expect: [{ amount: 25000, category: 'Income', sub: 'Salary', review: false }] },
    { id: 21, group: 'Typos & fuzzy',
      input: 'medisin 60 doctor 500',
      note: 'Phonetic Banglish medicine spelling + a second run-on pair.',
      expect: [
          { amount: 60, category: 'Healthcare', sub: 'Medicine' },
          { amount: 500, category: 'Healthcare', sub: 'Doctor Visit' }
      ] },
    { id: 22, group: 'Typos & fuzzy',
      input: 'brekfast 90',
      note: 'Dropped "a" in breakfast.',
      expect: [{ amount: 90, category: 'Food & Dining', sub: 'Restaurants' }] },
    { id: 23, group: 'Typos & fuzzy',
      input: 'shampu 180',
      note: 'Phonetic shampoo.',
      expect: [{ amount: 180, category: 'Personal Care' }] },

    // ---- Bengali script & Banglish -----------------------------------------
    { id: 24, group: 'Bengali & Banglish',
      input: 'রিকশা ৫০',
      note: 'Pure Bengali script: word and digits.',
      expect: [{ amount: 50, category: 'Transportation', sub: 'Public Transit' }] },
    { id: 25, group: 'Bengali & Banglish',
      input: 'চা ২০ বিস্কুট ১০',
      note: 'Two Bengali-script pairs, run-on.',
      expect: [
          { amount: 20, category: 'Food & Dining', sub: 'Coffee & Snacks' },
          { amount: 10, category: 'Food & Dining', sub: 'Coffee & Snacks' }
      ] },
    { id: 26, group: 'Bengali & Banglish',
      input: 'bazar korlam 1200 taka',
      note: 'Everyday Banglish sentence (sanity check — worked before).',
      expect: [{ amount: 1200, category: 'Food & Dining', sub: 'Groceries' }] },
    { id: 27, group: 'Bengali & Banglish',
      input: 'cha 15 ar singara 25',
      note: 'Banglish "ar" as the connector between two pairs.',
      expect: [
          { amount: 15, category: 'Food & Dining', sub: 'Coffee & Snacks' },
          { amount: 25, category: 'Food & Dining', sub: 'Fast Food' }
      ] },
    { id: 28, group: 'Bengali & Banglish',
      input: 'gari wash 400',
      note: '"gari" (car) — Banglish household word.',
      expect: [{ amount: 400, category: 'Transportation' }] },
    { id: 29, group: 'Bengali & Banglish',
      input: 'osudh kinlam 120',
      note: '"osudh" (medicine) — Banglish phonetic spelling.',
      expect: [{ amount: 120, category: 'Healthcare', sub: 'Medicine' }] },

    // ---- Income intent ------------------------------------------------------
    { id: 30, group: 'Income intent',
      input: 'got payement 5000',
      note: 'Misspelled "got payment" — must file as income, unflagged.',
      expect: [{ amount: 5000, category: 'Income', review: false }] },
    { id: 31, group: 'Income intent',
      input: 'salary dhukse 30k',
      note: 'Banglish "dhukse" (credited) + k-shorthand.',
      expect: [{ amount: 30000, category: 'Income', sub: 'Salary' }] },
    { id: 32, group: 'Income intent',
      input: 'freelance payment 12000',
      note: 'Freelance income (sanity check — worked before).',
      expect: [{ amount: 12000, category: 'Income', sub: 'Freelance' }] },
    { id: 33, group: 'Income intent',
      input: 'borrowed 2000 from friend',
      note: 'A loan is neither income nor a normal expense — must be flagged, never guessed.',
      expect: [{ amount: 2000, category: 'Other', review: true }] },
    { id: 34, group: 'Income intent',
      input: 'beton 20000 pelam',
      note: '"beton pelam" — got (my) salary, in Banglish.',
      expect: [{ amount: 20000, category: 'Income', sub: 'Salary' }] },

    // ---- Dates ---------------------------------------------------------------
    { id: 35, group: 'Dates',
      input: 'coffee 60 2 days ago',
      note: 'The classic last-number-wins bug: must log 60 dated 2 days back, not amount 2.',
      expect: [{ amount: 60, category: 'Food & Dining', sub: 'Coffee & Snacks', daysAgo: 2 }] },
    { id: 36, group: 'Dates',
      input: 'lunch 250 gotokal',
      note: '"gotokal" — yesterday in Banglish.',
      expect: [{ amount: 250, category: 'Food & Dining', sub: 'Restaurants', daysAgo: 1 }] },
    { id: 37, group: 'Dates',
      input: 'dinner 800 on 2027-12-31',
      note: 'A future date must be accepted but flagged for review.',
      expect: [{ amount: 800, category: 'Food & Dining', sub: 'Restaurants', date: '2027-12-31', review: true }] },
    { id: 38, group: 'Dates',
      input: 'rent 15000 last month',
      note: '"last month" → same day previous month, flagged because it is a guess.',
      expect: [{ amount: 15000, category: 'Bills & Utilities', sub: 'Rent/Mortgage', prevMonth: true, review: true }] },
    { id: 39, group: 'Dates',
      input: 'tea 20 last friday',
      note: '"last friday" must be strictly in the past — never today.',
      expect: [{ amount: 20, category: 'Food & Dining', sub: 'Coffee & Snacks', lastWeekday: 5 }] },

    // ---- Currency & numbers ---------------------------------------------------
    { id: 40, group: 'Currency & numbers',
      input: '৳১২০ চা এবং ৫০ rickshaw',
      note: 'Bengali currency symbol + digits + "এবং" (and) + script/English mix.',
      expect: [
          { amount: 120, category: 'Food & Dining', sub: 'Coffee & Snacks' },
          { amount: 50, category: 'Transportation', sub: 'Public Transit' }
      ] },
    { id: 41, group: 'Currency & numbers',
      input: 'coffee 3.5k',
      note: 'Decimal k-shorthand (sanity check — worked before).',
      expect: [{ amount: 3500, category: 'Food & Dining', sub: 'Coffee & Snacks' }] },
    { id: 42, group: 'Currency & numbers',
      input: '1.5k groceries and 2k bus',
      note: 'k-shorthand on both sides of "and" (sanity check — worked before).',
      expect: [
          { amount: 1500, category: 'Food & Dining', sub: 'Groceries' },
          { amount: 2000, category: 'Transportation', sub: 'Public Transit' }
      ] },
    { id: 43, group: 'Currency & numbers',
      input: 'lunch $12 and rickshaw 60 taka',
      note: 'Mixed currencies: the USD entry must carry a review flag (BDT account).',
      expect: [
          { amount: 12, category: 'Food & Dining', review: true },
          { amount: 60, category: 'Transportation', review: false }
      ] },
    { id: 44, group: 'Currency & numbers',
      input: 'iftar party for 40 people 3000',
      note: '"40 people" is a headcount, not a price.',
      expect: [{ amount: 3000, category: 'Food & Dining' }] },
    { id: 45, group: 'Currency & numbers',
      input: '-500 lunch refund',
      note: 'Negative amount + refund word — must flag, not silently log +500 as normal.',
      expect: [{ amount: 500, category: 'Food & Dining', review: true }] },

    // ---- Financial-semantics guards -------------------------------------------
    { id: 46, group: 'Semantics guards',
      input: 'transferred 10000 to savings',
      note: 'An account transfer is not spending — must be flagged for the human.',
      expect: [{ amount: 10000, category: 'Other', review: true }] },
    { id: 47, group: 'Semantics guards',
      input: 'paid credit card 25000',
      note: 'A card payment is not new spending — must be flagged.',
      expect: [{ amount: 25000, category: 'Other', review: true }] },
    { id: 48, group: 'Semantics guards',
      input: 'investment 5000',
      note: 'Income-category word without income wording — expense reading + flag (guard).',
      expect: [{ amount: 5000, category: 'Other', review: true }] },
    { id: 49, group: 'Semantics guards',
      input: 'netflix er bill 1100 taka dilam',
      note: 'The word "bill" must not hijack a clear Netflix subscription into Bills & Utilities.',
      expect: [{ amount: 1100, category: 'Entertainment', sub: 'Streaming Services' }] },
    { id: 50, group: 'Semantics guards',
      input: 'lottery 100',
      note: 'Unknown word — honest Other + flag beats a confident wrong guess.',
      expect: [{ amount: 100, category: 'Other', review: true }] }
];

// ---- gold evaluation ---------------------------------------------------------

function pad(n) { return String(n).padStart(2, '0'); }

function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function shiftDays(todayStr, daysAgo) {
    const [y, m, d] = todayStr.split('-').map(Number);
    return fmt(new Date(y, m - 1, d - daysAgo));
}

export function prevMonthSameDay(todayStr) {
    const [y, m, d] = todayStr.split('-').map(Number);
    const daysInPrev = new Date(y, m - 1, 0).getDate();
    return fmt(new Date(y, m - 2, Math.min(d, daysInPrev)));
}

export function lastWeekdayStrict(todayStr, dow) {
    const [y, m, d] = todayStr.split('-').map(Number);
    const todayDow = new Date(y, m - 1, d).getDay();
    const diff = ((todayDow - dow + 7) % 7) || 7; // strictly past
    return shiftDays(todayStr, diff);
}

function expectedDate(g, todayStr) {
    if (g.date) return g.date;
    if (g.daysAgo != null) return shiftDays(todayStr, g.daysAgo);
    if (g.prevMonth) return prevMonthSameDay(todayStr);
    if (g.lastWeekday != null) return lastWeekdayStrict(todayStr, g.lastWeekday);
    return null;
}

/**
 * Score one case. Strict: entry count, then per-entry amount + category, and
 * sub / date / review wherever the gold specifies them.
 * @returns {{ pass:boolean, problems:string[] }}
 */
export function evaluate(c, result, todayStr) {
    const problems = [];
    const got = result?.entries || [];
    if (got.length !== c.expect.length) {
        problems.push(`expected ${c.expect.length} entries, got ${got.length}`);
    }
    const n = Math.min(got.length, c.expect.length);
    for (let i = 0; i < n; i++) {
        const g = c.expect[i], e = got[i];
        const tag = c.expect.length > 1 ? `entry ${i + 1}: ` : '';
        if (e.amount !== g.amount) problems.push(`${tag}amount ${e.amount} ≠ ${g.amount}`);
        if (g.category && e.category !== g.category) problems.push(`${tag}category "${e.category}" ≠ "${g.category}"`);
        if (g.sub && e.subcategory !== g.sub) problems.push(`${tag}sub "${e.subcategory}" ≠ "${g.sub}"`);
        const wd = expectedDate(g, todayStr);
        if (wd && e.date !== wd) problems.push(`${tag}date ${e.date} ≠ ${wd}`);
        if (g.review !== undefined && e.needsReview !== g.review) {
            problems.push(`${tag}review ${e.needsReview} ≠ ${g.review}`);
        }
    }
    return { pass: problems.length === 0, problems };
}
