# PLAN-KEY-TURN — Ship BYO-key LLM mode (one day, timeboxed)

> Status: DRAFT — written 2026-07-15, for execution 2026-07-16.
> Rule for the day: this is a **verify + upgrade** day. The pipeline already
> exists end-to-end; if any phase balloons, cut from the bottom, never extend
> the day. The 10-user test stays the next milestone and does not depend on
> this — testers use the free parser.

## What already exists (do NOT rebuild)

| Piece | File | State |
|---|---|---|
| Settings UI (provider/model/key) | `js/features/assistant/settings.js` + `index.html` assistant tab | Done. Key in own localStorage keys, never synced to Sheet |
| Anthropic adapter | `js/features/assistant/provider-anthropic.js` | Done. Browser header, structured output + 400-retry fallback, refusal handling |
| OpenAI adapter | `js/features/assistant/provider-openai.js` | Done. `response_format: json_schema` + same fallback |
| Dispatcher + JSON repair | `js/features/assistant/providers.js` | Done. Handles ```json fences from older models |
| Prompt + sanitizer | `js/features/assistant/engine-llm.js` | Done but **minimal** — this is where tomorrow's value is |
| Chat routing | `js/features/assistant/index.js` | Done. Key present → LLM, else parser; same preview/confirm/audit log |

**Never verified with a real key.** That's the first job.

## Phase 0 — Verify the existing path (morning, ~1–2h, no code)

1. Paste a real Anthropic key in Settings → Assistant, send ~10 corpus lines
   through the chat panel (plain, Bengali, run-on, income). Note failures.
2. Same with an OpenAI key if available; otherwise skip — Anthropic is the default.
3. Check the two API-shape risks against current docs (use Claude Code's
   `/claude-api` reference skill, don't guess):
   - Anthropic structured-output body shape (`output_config.format` — confirm current).
   - `DEFAULT_MODELS`: `claude-opus-4-8` is overkill-expensive for extraction.
     **Decision (default yes): switch to Haiku 4.5** — extraction is easy work;
     cheap + fast matters for a chat loop. Keep the field user-editable as is.
4. Verdict gate: if the path is broken, the rest of the day is fixing adapters
   and nothing else. If it works, proceed.

## Phase 1 — Schema upgrade: let the model say what the parser can't (~2h)

`ENTRY_SCHEMA` + `sanitizeEntries()` in `engine-llm.js`:

- Add `kind`: `expense | income | transfer | refund | loan | credit_card_payment`.
  - `transfer` / `credit_card_payment` → **drop the entry** (not an expense;
    prompt tells the model to explain in `reply`). This is the single biggest
    bookkeeping win — correct books beat a complete-looking log.
  - `refund` / `loan` → keep, force `needsReview: true`.
- Add `unsure: boolean` → maps to `needsReview`. Today LLM entries come back
  `confidence: 'high'` unless the sanitizer remapped something — the model has
  no way to express doubt. This restores the parser's never-silent-wrong
  contract in LLM mode.
- Add optional `currency` (ISO code) → differs from user's currency ⇒
  `needsReview: true` (mirror the parser's policy exactly).
- Sanitizer stays the trust boundary: unknown `kind` → treat as expense +
  flag; unknown currency string → ignore. Never trust, always clamp.

## Phase 2 — Prompt upgrade (~1h, `buildSystemPrompt`)

Add rules for exactly the cases in `docs/PARSER_LIMITATIONS.md` the LLM tier
was promised to fix, nothing more:

- Billing periods: "rent for July" → date = first of that month, `unsure: true`.
- Shared costs: "dinner 3000 split 5" → amount = personal share (600).
- Transfers / credit-card payments → no entry; say why in `reply`.
- Mixed currency lines → split into per-currency entries with `currency` set.
- Keep descriptions in the user's own words; never invent categories (already there).

## Phase 3 — Safety + tests (~1–2h)

- OpenAI body: add a max-tokens cap (Anthropic already has 1024).
- Smoke tests (pure functions, no network — extend `tests/smoke.html`):
  - `sanitizeEntries`: transfer dropped, refund flagged, `unsure` → review,
    foreign currency → review, junk `kind`/`currency` clamped.
  - `tryParseJson`: fenced/plain (if not already covered).
- Manual drive with real key, the acceptance set:
  - `transferred 10000 to savings` → **0 entries**, reply explains
  - `paid credit card 25000` → 0 entries
  - `rent for July 15000` → July date + ⚠
  - `dinner 3000 split 5` → 600
  - `uber $8.50 and rickshaw 60 taka` → 2 entries, USD flagged
  - `got refund 2000 from daraz` → 1 entry ⚠
- Commit in small conventional commits (`feat(assistant): …`), one per phase.

## Explicitly OUT of scope tomorrow

- Capture box stays parser-only (free tier = instant, offline, private —
  LLM latency would kill the "git commit for money" feel).
- No streaming, no key-test button, no proxy backend, no learned-context
  injection into the prompt, no corrections-via-chat. All post-10-user-test.

## Decisions locked unless overridden

1. Default Anthropic model → Haiku 4.5 (cheap extraction).
2. Transfers → dropped, not logged-and-flagged.
3. LLM stays behind the existing Pro/trial gate in the chat panel.
