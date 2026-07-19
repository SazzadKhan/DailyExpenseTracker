# Adding a New Language to the XpenseBot Parser

The parser is an **engine + language data**. The engine (segmentation,
pair-splitting, amount extraction, match priority, the income guard, the
learning layer) is language-agnostic — it already serves English, Banglish,
and Bengali script through one code path. Supporting a new language means
supplying **data**, running the **loop** below, and touching no engine logic.

> **Current state:** the language data still lives as named constants at the
> top of `js/features/assistant/parser.js` (the planned extraction into
> `js/features/assistant/langs/<code>.js` packs has not happened yet). This
> guide describes both what to fill in *today* and the pack schema that
> extraction will formalize. Doing the extraction first is recommended if you
> are adding a third language — the 150-case gold suite plus
> `tests/smoke.html` (84 assertions) make that refactor safely verifiable.

---

## What a language supplies (the pack schema)

Each row is a constant in `parser.js` today and one field of the future pack:

| Field | Constant today | What it is | Bengali example |
|---|---|---|---|
| `digits` | `BN_DIGITS` | native digit → ASCII map | `৫` → `5` |
| `typos` | `TYPOS` | curated misspellings (2+ edits or colliding) | `riksha` → `rickshaw` |
| `synonyms` | `SYNONYMS` | spoken word → `[category, subcategory\|null]` against DEFAULT category names | `'ডিম': ['Food & Dining', 'Groceries']` |
| `phrases` | `PHRASES` | multi-word overrides for collisions word-matching gets wrong | `pathao food` → Delivery |
| `units` | `UNIT_WORDS` | words that make the number before them a *quantity* | `hali` (4-pack of eggs) |
| `leadVerbs` | `LEAD_VERBS` | verbs that precede an amount without being the item | `kinlam`, `dilam` |
| `connectors` | in `splitOnAnd()` | the language's "and" | `এবং`, `আর`, `ar` |
| `incomeIntent` | `INCOME_INTENT` | explicit income wording (keep it NARROW) | `beton`, `pelam`, `dhukse` |
| `reviewWords` | `REVIEW_WORDS` | money-meaning ambiguity → force ⚠ | `dhar` (debt) |
| `fuzzySkip` | `FUZZY_SKIP` | common words the typo-corrector must never touch | `saving` (1 edit from *shaving*) |
| `dates` | in `extractDate()` | relative-date words | `gotokal` = yesterday, `N din age` |
| `fuzzyConfig` | hardcoded | whether edit-distance applies to this script | Latin only; **off** for Bengali script |

Known gap you'd close for Bengali, as an example of pack work: script-form
dates (`তিন দিন আগে` = 3 days ago) are not parsed today — the entry still
files correctly but dated today.

## The loop — support on demand, one iteration at a time

This exact loop was run twice for Bengali/Banglish (see the numbers on
`tests/extreme-suite.html`); each turn took roughly one working session.

```
1. CORPUS   Collect 100–150 REAL logging lines from native speakers —
            short, typo-ridden, amount-first, code-switched. Not clean
            textbook sentences. Production sources: the assistant's audit
            log and the learned-layer miss tracker (with consent).

2. GOLD     A native speaker writes the expected result for each line in
            the tests/extreme-cases-*.js format (schema below). Follow the
            house policy: genuinely ambiguous money-talk (loans, transfers,
            refunds, bare amounts) is gold-labelled review:true — the
            CORRECT answer is a flag, not a confident guess.

3. BLIND    Score the untouched parser against the new gold file and
            RECORD the number. This is the honest baseline (Bengali wave 2
            scored 68/100 blind). Never skip this step — it is what makes
            the "after" number credible.

4. AUTHOR   Fill the pack fields. The blind failure report is literally a
            shopping list — for Bengali wave 2, ~90% of misses were just
            missing synonyms.

5. VERIFY   All of these must be green before shipping:
            □ the new language's gold file
            □ EVERY other language's gold files (cross-pack collisions are
              real — "savings"↔"shaving" happened WITHIN one pack)
            □ tests/smoke.html — 84 assertions incl. zero-silent-wrong and
              the ≥85% corpus floor
            □ a probe of ~15 lines you did NOT write gold for: every miss
              must fail flagged-⚠, never confidently wrong

6. SHIP     Load the pack by the user's language setting (dynamic import()
            — no build step, this repo forbids one). Base English merges
            with the locale pack; users code-switch, so merge, don't switch.

7. LISTEN   The learned layer keeps a per-user miss tracker; the audit log
            records every parse. Those misses are the next iteration's
            corpus. → goto 4.
```

### Gold-case format

```js
{ id: 51, group: 'Amount-first, typos, run-on',
  input: '80 dim 60 pauruti',
  note: 'Banglish staples: dim (eggs), pauruti (bread), amount-first.',
  expect: [
      { amount: 80, category: 'Food & Dining', sub: 'Groceries' },
      { amount: 60, category: 'Food & Dining', sub: 'Groceries' }
  ] }
```

`expect` fields beyond `amount` are optional and only checked when present:
`category`, `sub`, `review` (true/false), `date` ('YYYY-MM-DD'), `daysAgo`,
`prevMonth`, `lastWeekday` (0=Sun). Score with `evaluate()` from
`tests/extreme-cases-50.js` — the same function `tests/extreme-suite.html`
uses, so your results are reproducible on a web page anyone can open.

## Graceful degradation — why "on demand" is safe

A language with **no pack at all** still works at a floor: amounts, literal
dates and digits are extracted, everything files as Other ⚠ for one-tap
review, and the **learning layer is language-agnostic** — a user's own
accepted history starts auto-filing their words after two accepts, before any
pack exists. The BYOK LLM mode (`engine-llm.js`) is inherently multilingual
and covers the gap for Pro users immediately; its audit-log output can
bootstrap the pack corpus.

## Hard-won cautions

- **Keep `incomeIntent` narrow.** Bare "paid" is spending; only "got paid" is
  income. When income wording surrounds an expense-category word the engine
  flags the conflict — don't try to outsmart it with broad intent words.
- **Fuzzy matching is Latin-only** and needs the stoplist grown alongside the
  vocabulary: every new synonym is a new collision surface (adding *shaving*
  broke *savings* until the stoplist caught it). For abugidas/CJK leave
  edit-distance off.
- **Reserved unknowns:** `coaching`, `tiffin`, `bkash`, `flexiload`, `mess`
  must stay OUT of every pack — the learning-layer demos and the suggestion
  loop depend on them being unknown words.
- **Never map a word to a category the user might have deleted** — the engine
  already validates every synonym against the user's live categories; packs
  target DEFAULT category names only.
- **Don't add month names or billing-period grammar** ("for July") without
  reading `docs/PARSER_LIMITATIONS.md` §3 first — it's deliberately deferred
  to the LLM tier.

## Definition of done for a language

1. Gold file ≥ 100 cases, blind number recorded and quoted honestly.
2. ≥ 85% exact on the gold file after authoring; **100% of misses flagged**.
3. All other languages' suites + smoke.html green.
4. `tests/extreme-suite.html` extended to include the new wave.
5. A native speaker has eyeballed 20 live parses in the app's preview card.
