# XpenseBot Parser — Technical Guide (v3)

The offline, rule-based natural-language expense parser with a per-user
learning layer. Zero network, zero cost, ~instant; the optional BYOK LLM mode
(`engine-llm.js`) sits on top for the cases rules can't decide (see
`PARSER_LIMITATIONS.md`). Companion docs: **PARSER_RULES.md** (every rule
with verified examples) and **ADDING_A_LANGUAGE.md** (the language loop).

## Modules

```
js/features/assistant/
  parser.js       the rule engine — PURE module: no DOM, no store, no
                  localStorage; categories/date/currency come in as arguments
  learned.js      per-user learning: accepted-entry index, miss tracker,
                  subcategory suggestions (pure; persistence handled by caller)
  engine-llm.js   optional BYOK LLM engine (Pro tier)
  audit-log.js    every parse outcome, exportable — the improvement corpus
  index.js        chat UI wiring; capture box lives in js/features/capture/
```

## API

```js
import { parse } from './parser.js';

const { entries, unmatched } = parse(text, {
    categories,           // the user's live Categories object (required in practice)
    todayStr,             // local 'YYYY-MM-DD' (defaults to today)
    currencyCode,         // e.g. 'BDT' — mismatched currencies get flagged
    learned               // Map from buildLearnedLookup(data, categories) | null
});
// entries: [{ date, category, subcategory, amount, description,
//             confidence: 'high'|'medium'|'low', needsReview: boolean }]
// unmatched: string[]  — text that never became an entry (no valid amount)
```

`parse` never throws on user input and never mutates its arguments. Money is
`Number`; dates are local `YYYY-MM-DD` strings (`core/format.js` — see
`TIMEZONE_BUG.md` for why you must never `new Date('YYYY-MM-DD')`).

## Pipeline

```
text
 │ normalize()       Bengali digits → ASCII · curated TYPOS · k-shorthand
 │ segment()         \n ; , splits · thousand-comma collapse ·
 │                   and/nd/ar/ebong/এবং/আর splits (digitless chunks merge)
 │ extractDate()     per segment, BEFORE amounts — so "2 days ago" can never
 │                   become amount 2; returns {date, cleaned, approx?}
 │ pairSplit()       run-on segments → amount+item groups; orientation
 │                   detection (item-first / amount-first), LEAD_VERBS skip,
 │                   UNIT_WORDS quantity guard, "at N" time guard,
 │                   quantity-fusion ("bought 2 shirts 1600" = one purchase)
 │ extractAmount()   last non-quantity number · negative flag · currency
 │                   token detection/strip
 │ matchCategory()   classification (priority below)
 └ scoring           confidence + needsReview flags → ParsedEntry
```

### Classification priority (first hit wins)

```
1. PHRASES            curated multi-word overrides ("gas bill", "pathao food")
2. taxonomy index     the user's own category/subcategory names
                      (bigrams → single words, singular/plural folded)
3. ctx.learned        the user's accepted history (learned.js)
4. SYNONYMS           built-in pack, validated against live categories
5. fuzzyMatch()       unique edit-distance-1 into 2–4's vocabulary
6. income fallback    INCOME_INTENT wording with no category word
7. Other + ⚠          honest fallback; feeds the learning layer
```

Two structural subtleties:

- **Fragments.** `buildKeywordIndex` marks a single word taken from a
  multi-word *category* name (`bill` from "Bills & Utilities") as
  `fragment: true`. A fragment loses to subcategory-level synonym/typo
  evidence — this is why "netflix er bill" files under Streaming Services
  while bare "bill 500" still reaches Bills & Utilities.
- **Income slots.** The index keeps separate expense/income slots per word
  ("gift" is both Shopping › Gifts and Income › Gift); `INCOME_INTENT`
  wording selects the slot. A collision without intent resolves to the
  expense reading **and flags ⚠**. Income wording around an expense-category
  match ("sold old phone 3500") also flags — conflicting signals ask the human.

### Invariants (enforced by tests — do not relax)

1. **Zero silent-wrong.** A wrong category may only ship carrying
   `needsReview: true` (smoke.html corpus test fails otherwise).
2. **No invented entries.** No valid positive amount → `unmatched`, not an
   entry (zero and quantity-only lines included).
3. **Income requires intent.** Nouns never flip a transaction to income.
4. **Ambiguous money-meaning flags** (refund/transfer/loan/credit-card/
   negative amounts/future dates/"last month" guesses/foreign currency).
5. **User taxonomy beats the pack; user history beats the pack; the pack
   never targets a category the user deleted.**

## Performance notes

- `buildKeywordIndex` is cached in a `WeakMap` keyed on the categories object
  — safe because the store replaces, never mutates, state (AGENTS.md rule 3).
- The fuzzy pass runs only for words nothing else matched, over ~350 keys with
  a cheap length pre-filter; worst case is microseconds per unknown word.
- Everything is synchronous and allocation-light; a full 150-case suite parse
  runs in well under 100 ms in the browser.

## Testing infrastructure

| Asset | What it proves |
|---|---|
| `tests/smoke.html` | 84 assertions: engine contracts, income guard, learned layer, **zero silent-wrong + ≥85% corpus floor** |
| `tests/extreme-cases-50.js` | wave-1 gold (drove the v3 rewrite) + the shared `evaluate()` scorer |
| `tests/extreme-cases-100.js` | wave-2 gold, written *after* v3 and scored **blind** first (v3: 68/100 untouched, v2: 40/100) — the generalization protocol; keep it for every future wave |
| `tests/parser-v2-baseline.js` | frozen v2 — the before/after comparison anchor; never edit |
| `tests/extreme-suite.html` | all 150 cases run LIVE against frozen v2 vs current parser, scored in the browser; the shareable proof page |
| `tests/parser-before-after.html` | the learning layer's before/after on a simulated 14-day diary |

Headless runs: this repo has no package.json (by policy) and Node 18 can't
import the ES modules in place — copy `js/` + the `tests/*.js` data modules
into a scratch dir with `{"type":"module"}` and run `.mjs` scripts there;
browser verification via `npx http-server` (ES modules are CORS-blocked over
`file://`).

## Version history

- **v1** — fixed grammar: comma/and splits, keyword match, preview-always.
- **v2** — income guard, phrase overrides, singular folding, Banglish synonym
  pack, learned index (commits `febc790`…`fbc5836`).
- **v3** — run-on pair splitting, typo tolerance (curated + edit-distance-1),
  Bengali-script vocabulary + mark-aware tokenizer, date grammar (N days ago,
  gotokal, last month, last weekday, future flag), quantity/unit guards,
  fragment rule, conflicting-signals flag, BD merchants. Measured: extreme
  suite 55/150 → 150/150 vs v2; wave-2 blind 68/100 with all misses flagged.

## What stays out of the rules (LLM tier)

Splitting combined amounts ("lunch and coffee 450 — which was what?"),
billing-period dates ("for July"), refund/transfer semantics beyond flagging,
duplicate detection, corrections via chat. Full analysis:
`PARSER_LIMITATIONS.md`. The rule engine's job is to be **fast, free, private,
and never silently wrong**; the LLM's job is the last 10–15%.
