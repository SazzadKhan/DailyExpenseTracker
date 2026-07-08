# XpenseBot Parser Limitations — Edge Cases Requiring LLM

The rule-based parser handles ~85% of simple expense logging. The remaining 15% — particularly high-value transactions and complex financial semantics — require LLM reasoning.

## 1. Transaction Boundary Ambiguity (Hard)

**Problem**: Determining where one transaction ends and another begins is fundamentally ambiguous without context.

### Cases the parser FAILS on:

- **"Bought groceries 500 and fish 350 from Agora and paid internet bill 1200"**
  - Parser: Splits as 3 transactions (groceries, fish, internet) ✓ Lucky
  - But should it be: Groceries+fish combo (850) + internet (1200)?
  - No rule can decide this consistently

- **"Lunch and coffee with client for 450"**
  - Parser: Single transaction (safest default) ✓ Sometimes right
  - But the user might mean: Lunch 300 + coffee 150
  - Or: Total was 450, no split needed
  - No rule can disambiguate

- **"Uber to office and lunch cost me 500"**
  - Parser: Single transaction 500 (safest)
  - User might mean: Uber 200 + lunch 300 = 500 total
  - Or: Separate trips, total happens to be 500
  - **LLM solution**: Parse "and" as semantic connector when both sides have activity descriptors

- **"Paid 1500 for groceries and utilities yesterday"**
  - Could be: One combined bill (1500 total) or two separate (amounts unknown)
  - Parser flags it but doesn't split

### Why LLM helps:
- LLM understands "paid X for A and B" as potentially multiple line items
- LLM can recognize semantic markers: "each", "split", "combined", "including"
- LLM has world knowledge: "utilities" typically = one bill, "groceries and utilities" = two bills

**Test case for LLM version**:
```
"Paid rent 15000 and utilities 3500 yesterday"
Expected: 2 entries (rent, utilities)
Parser produces: Ambiguous, likely 1-2 entries depending on implementation
LLM produces: Reliably 2 entries with correct split
```

---

## 2. Multi-Currency Transactions (Medium)

**Problem**: User spending across currencies without explicit markers.

### Cases the parser FAILS on:

- **"Lunch $12 and taxi 450 in mixed BDT/USD setting"**
  - Parser: Single entry 450 (last number), currency flags $12 as conflict
  - Reality: Should be 2 entries with 2 currencies
  - No rule can parse "$12 and taxi 450" → (12 USD) + (450 BDT)

- **"Paid 500 for Uber, 300 for coffee, total was different"**
  - No currency symbols at all
  - Parser defaults to settings.currency
  - Wrong if user paid in multiple currencies

- **"Got salary 50000 taka and $500 bonus"**
  - Parser: Last amount (500) with USD symbol
  - Reality: Two entries, two currencies
  - No rule maps "$500" + prior amount correctly

### Why LLM helps:
- LLM recognizes currency context: "$12" implies USD, "450 taka" implies BDT
- LLM can split multi-currency transactions: "lunch 12 dollar and taxi 450" → (USD 12) + (BDT 450)
- LLM knows default currency per merchant: "Starbucks" → usually USD, "Agora" → usually BDT

**Test case for LLM version**:
```
"Paid Uber $8.50 and rickshaw 60 taka"
Expected: 2 entries (USD 8.50, BDT 60)
Parser produces: Fails, ambiguous
LLM produces: Reliable split with currencies
```

---

## 3. Date Ambiguity (Medium-Hard)

**Problem**: Relative dates are context-dependent; the parser handles only past references.

### Cases the parser FAILS on:

- **"Paid rent for July" (in August)**
  - Parser: Date = today (August), "for July" stays in description
  - Reality: Should be July (past month)
  - No rule reliably maps "for X month" to the date

- **"Paid internet bill last month"**
  - Parser: No date keyword, defaults to today
  - Reality: Could mean last calendar month, or 30 days ago
  - Context-dependent

- **"Bought flight for next Friday"** (current week context unknown)
  - Parser: Last Friday < today (past logic)
  - Reality: Might be an expense for a future date (advance purchase)
  - Parser never handles future dates

- **"Paid commission for Q3"** (quarter-based billing)**
  - Parser: No match, defaults to today
  - Reality: User needs Q3 date range or specific date

- **Ambiguous weekdays**:
  - "Paid on Wednesday" when spoken on Thursday vs Saturday
  - Parser finds the most recent Wednesday
  - Could be wrong (user might mean this week vs last week)

### Why LLM helps:
- LLM understands billing-cycle language: "for July", "Q3", "last quarter"
- LLM recognizes future transactions: "flight for next week" (not past)
- LLM has temporal reasoning: Given today's date, resolve ambiguous periods

**Test case for LLM version**:
```
Input: "Paid internet bill for June" (spoken in July)
Expected: June date (not today)
Parser produces: Today (no match)
LLM produces: Correct June date with reasoning
```

---

## 4. Financial Semantics (Very Hard)

**Problem**: Words that flip the meaning of a transaction without clear markers.

### Cases the parser FAILS on:

#### A. Refunds, Returns, Credits
- **"Got refund 2000"**
  - Parser: Income flag (needsReview), but category guessed
  - Reality: Could be expense refund (return), insurance claim (income), or charge reversal (context-specific)
  - No rule determines the financial meaning

- **"Returned laptop, got credit 50000"**
  - Parser: Flags as "refund" word, but amount/category ambiguous
  - Reality: Return credit (contra-asset) vs refund (income) vs store credit (liability)?

#### B. Transfers (Not an expense)
- **"Transferred 10000 to savings account"**
  - Parser: Would treat as expense
  - Reality: Asset movement, not an expense at all
  - No rule recognizes "transfer" as non-expense semantic

- **"Moved 5000 from checking to investment account"**
  - Parser: Would log as expense if pattern matched
  - Reality: Should not appear in expense ledger

#### C. Credit Card Payments (Already accounted)
- **"Paid credit card 25000"**
  - Parser: Treats as expense
  - Reality: Not an expense; original purchase was already logged
  - Duplicate if not caught

- **"Made payment on credit card for groceries bill"**
  - Ambiguous: Is this the expense or the payment?

#### D. Shared/Reimbursable Expenses
- **"Lunch 3000 split among 5 people"**
  - Parser: Logs 3000
  - Reality: Personal expense = 600 (3000/5), cash flow = 3000, reimbursable balance affects others
  - No rule handles fractions or reimbursement tracking

- **"Paid for office lunch, will be reimbursed"**
  - Parser: Logs as normal expense
  - Reality: Needs separate "reimbursable" flag or category

#### E. Loan/Debt Transactions
- **"Lent friend 5000"**
  - Parser: Logs as expense
  - Reality: Asset transfer (friend owes money), not personal expense

- **"Took loan 50000"**
  - Parser: Could flag as unusual
  - Reality: Liability, not income or expense

### Why LLM helps:
- LLM understands financial domain: refund ≠ credit ≠ transfer ≠ loan
- LLM asks clarifying questions: "Is this a personal expense or a reimbursable work cost?"
- LLM recognizes double-entry accounting: "paid credit card" is a reversal, not an expense
- LLM can set semantic flags: `:reimbursable`, `:shared`, `:transfer`, `:loan`

**Test cases for LLM version**:
```
"Transferred 10000 to savings"
Expected: Skip logging (asset transfer, not expense)
Parser produces: Logs as expense
LLM produces: Recognizes as transfer, no entry

"Refund from electronics store 2500"
Expected: Expense refund (negative), category: Shopping/Electronics
Parser produces: Income flag, ambiguous category
LLM produces: Correctly as refund (contra-expense)

"Paid credit card 30000 for last month's groceries"
Expected: Recognizes as payment against past expenses (don't log again)
Parser produces: Logs as expense
LLM produces: Flags as potential duplicate or payment transaction
```

---

## 5. Category Explosion & Merchant Context (Medium)

**Problem**: Same word means different categories depending on context.

### Cases the parser FAILS on:

- **"Kacchi 500"**
  - Parser: Food & Dining › Restaurants (keyword match)
  - Reality: Could be:
    - Restaurant meal (expense)
    - Groceries (buying raw meat from market)
    - Business/catering cost
  - Context matters: "ordered kacchi" vs "bought kacchi from butcher"

- **"Starbucks 200"**
  - Parser: Coffee & Snacks (keyword match)
  - Reality: Could be:
    - Personal coffee (expense)
    - Business meeting (business entertainment)
    - Subscription/card reload (different category)

- **"Amazon 3000"**
  - Parser: Shopping (keyword match)
  - Reality: Could be:
    - Personal purchase (Shopping)
    - Business supplies (Business Expense)
    - Cloud hosting (Business/Infrastructure)
    - Kindle books (Education)
    - Kindle subscriptions (recurring)

- **"Google 500"**
  - Parser: Unclear, likely "Other"
  - Reality: Could be:
    - Google Workspace (business)
    - Google Cloud (infrastructure)
    - Google Play purchase (entertainment)
    - Ads spend (business marketing)

- **"Steam 1500"**
  - Parser: Entertainment › Games (keyword match)
  - Reality: Could be:
    - Gaming (entertainment)
    - Business asset (game for testing)
    - Gift (for someone else)

### Why LLM helps:
- LLM has world knowledge: "Starbucks location X" with context implies personal coffee vs business meeting
- LLM recognizes company/service types: Amazon = marketplace, Google = cloud provider
- LLM can preserve merchant name in description for context
- LLM asks one clarifying question if confidence is low

**Test cases for LLM version**:
```
"Bought kacchi from butcher 750"
Expected: Food & Dining › Groceries (bought ingredients, not dining)
Parser produces: Food & Dining › Restaurants (kacchi keyword)
LLM produces: Groceries (understands "from butcher" as shopping, not dining)

"Amazon purchase 5000"
Expected: Could be Shopping, Business, or Education (asks if ambiguous)
Parser produces: Shopping (default)
LLM produces: Asks "Was this for personal or business?" if context unclear
```

---

## 6. Language Mixing (Banglish, Code-Switching) (Hard)

**Problem**: Users mix Bengali, English, and Banglish; parser handles only pure Bengali digits.

### Cases the parser FAILS on:

- **"Rickshaw 50, lunch 250, বিকাশে 5000 salary আসছে, medicine 350"**
  - Parser: Recognizes "Rickshaw" (keywords), Bengali digits ৫০০০
  - Reality: "বিকাশে...আসছে" (bKash...coming/arriving) = income notification, not expense
  - No rule understands Bengali sentence structure

- **"Coffee 100, nari 50 chol"** (Banglish for "khotey jeo" = transportation)
  - Parser: "Coffee" matches, "nari" and "chol" don't match synonyms
  - Reality: "nari 50 chol" means 50 taka for transportation/ride
  - Banglish slang not in synonym pack

- **"রিকশা ৫০" (pure Bengali: rickshaw 50)**
  - Parser: Won't recognize Bengali words (expects English keywords)
  - Reality: Valid expense in Bengali

- **"Lunch 150 চায়ে 30"** (mixed: lunch, then Bengali tea)
  - Parser: Handles "lunch 150", fails on "চায়ে 30"
  - Reality: Should extract both

- **"🍔 350, 🚕 150"** (emoji-first entries)
  - Parser: Tries to parse emoji; likely fails unless emoji matches category icons
  - Reality: Should extract amounts and guess category from emoji

### Why LLM helps:
- LLM is multilingual: understands Bengali, English, Banglish equally
- LLM can transliterate Banglish to Bengali/English for categorization
- LLM recognizes code-switching: switches between languages mid-sentence
- LLM understands emoji semantics: 🍔 = food, 🚕 = transport

**Test cases for LLM version**:
```
"রিকশা ৫০, খাবার ৩০০, ইন্টারনেট বিল ১২০০"
Expected: 3 entries (transportation, food, utilities)
Parser produces: Fails (Bengali keywords)
LLM produces: Translates and extracts correctly

"Chai 50 চা ৩০ tea 25"
Expected: 3 entries (all tea/snacks variations)
Parser produces: "Chai" matches, rest fail
LLM produces: Recognizes all as beverages, extracts all 3
```

---

## 7. User Corrections via Chat (Very Hard)

**Problem**: Conversation-based corrections require context and versioning.

### Cases the parser FAILS on (inherently sequential):

- **User**: "Lunch 350"  
  Bot logs it.  
  **User**: "Actually it was 450"
  - Parser: Would create a new entry instead of correcting
  - Reality: User wants to correct previous entry
  - No event sourcing or conversation context

- **User**: "Coffee and lunch 300"  
  Bot: 1 entry, 300 total (default safe behavior)  
  **User**: "No, coffee was 80 and lunch was 220"
  - Parser: Can't retroactively split a logged entry
  - Reality: Need to update/correct and log the change
  - Would need edit modal (out of band), not chat

- **User**: "Got paid 50000"  
  Bot: Logs as income  
  **User**: "Wait, that's old data, was last month"
  - Parser: Already committed
  - Reality: Need date correction with audit trail

### Why LLM doesn't fully solve this either:
- LLM can parse "Actually 450" as a correction intent
- But still needs backend versioning, event sourcing
- **Parser + chat = incomplete without architecture changes**

**Deferred to Sprint 3**:
```
- User corrections via chat ("Actually 450")
- Event sourcing & transaction versioning
- Audit logs + correction trails
- Existing edit modal remains the correction path in v1
```

---

## 8. Duplicate Detection (Medium)

**Problem**: Detecting if two entries are the same transaction or different.

### Cases the parser FAILS on:

- **User logs**: "Uber 250"  
  Then later: "Transportation 250"
  - Are these the same trip or different trips?
  - Parser: Both logged as separate (no cross-checking)
  - Reality: Need heuristics: same amount + same category + same time = likely duplicate

- **"Tea 50" logged twice within 5 minutes**
  - Accidental duplicate or two teas?
  - Parser: Logs both
  - Reality: Probably accidental re-send

- **"Lunch 350" Tuesday, "Lunch 350" Wednesday**
  - Same amount, same category, different dates
  - Probably different days (legitimate)
  - But could be a copy-paste error

### Why LLM helps:
- LLM can reason about likelihood: "Uber 250 at 2:30pm" + "Transportation 250 at 2:35pm" = likely same
- LLM can ask clarification: "I see two identical entries 2 minutes apart—is this a duplicate?"
- LLM has temporal reasoning for "same time" heuristics

**Test case for LLM version**:
```
Logged: "Uber 250" at 14:30
Then: "Transportation 250" within 5 minutes
LLM recognizes: Likely duplicate, suggests merge
Parser produces: Logs as separate, silent risk
```

---

## 9. Ambiguity Budget Balance (Very Hard)

**Problem**: Balancing "ask questions" vs "silently guess" affects retention.

- Ask 30% of the time → user leaves (annoying bot)
- Wrong 10% of the time → user doesn't trust (broken bot)
- Both need to stay below threshold

### Cases requiring judgment:

- **"Paid 500"** (no category)
  - Parser: Falls back to "Other" + needsReview flag
  - LLM: Asks "Was this for food, transportation, or other?"
  - Which is worse: silent fallback or a question?
  - **No deterministic answer**

- **"Groceries 300 yesterday"**
  - Confidence 95% (clear category, date, amount)
  - Parser: Logs directly (high confidence auto-commits?)
  - Reality: v1 always shows preview, never auto-commits

- **"Electricity bill 1200 for July"**
  - Category clear (Utilities)
  - Date ambiguous ("for July" = billing period? payment date?)
  - Parser: Logs with today's date, "for July" in description
  - LLM: Could ask "Is July 1 or July 31?" (costs engagement)
  - Or: Just guess "July 1" (costs accuracy)

### Why LLM helps:
- LLM can estimate confidence scores based on language patterns
- LLM can decide which ambiguities are worth asking about
- LLM can frame questions conversationally, reducing friction

**Test case for LLM version**:
```
"Paid for office rent this month 15000"
Parser: Logs with date=today, "this month" in description
LLM: Recognizes "for this month" as billing context, might adjust date
     Or asks: "Should this be dated on the first or last day of the month?"
```

---

## 10. Personalization & Category Learning (Hard)

**Problem**: User's personal taxonomy and spending patterns are unique.

### Cases the parser FAILS on:

- **User always says "Agora" but parser categorizes as "Groceries"**
  - Reality: User wants their own "Markets" category
  - Parser: Only matches defined categories
  - No personalization

- **"Petrol" usually classified as Transportation › Fuel**
  - But for this user, sometimes it's "Business › Delivery Expenses"
  - Context-dependent categorization

- **User invented category "Fun Money" or "Pocket Expenses"**
  - Parser: Doesn't recognize it (not in system categories)
  - Reality: User wants their own taxonomy

### Why LLM helps (with per-user training):
- LLM can learn user's personal vocab over time
- LLM can recognize "You usually put this in X category" from audit log
- LLM can suggest category overrides based on patterns

**Deferred to Sprint 3**:
```
- Per-user category overrides
- Personalization engine
- Audit log as training data
- Category learning from user corrections
```

---

## 11. Proactive Suggestions (Very Hard)

**Problem**: Surfacing insights without being intrusive.

### Cases that need world knowledge:

- **Bill prediction**: "Electricity bill is usually due this week"
  - Parser: Can't predict
  - LLM: Could surface reminders based on recurring patterns

- **Spending anomaly**: "You usually spend 50k on fuel, but this month it's 65k"
  - Parser: No pattern matching
  - LLM + analytics: Could flag outliers

- **Merchant insights**: "You spent 500 on Starbucks this week; usual is 100"
  - Parser: No aggregation
  - LLM: Could surface patterns

---

## Summary Table: What Requires LLM

| Edge Case | Parser | LLM | Severity |
|-----------|--------|-----|----------|
| **Transaction splitting** (commas, "and") | ❌ Ambiguous | ✅ Context-aware | HARD |
| **Multi-currency** ($X + Y local) | ❌ Guesses last number | ✅ Splits correctly | MEDIUM |
| **Date ambiguity** ("for July", future dates) | ⚠️ Defaults to today | ✅ Contextual | MEDIUM-HARD |
| **Refunds vs credits vs transfers** | ⚠️ Flags only | ✅ Understands intent | VERY HARD |
| **Category by context** (Starbucks = coffee or business?) | ⚠️ Defaults | ✅ Asks 1 question | MEDIUM |
| **Banglish/mixed language** | ❌ English only | ✅ Multilingual | HARD |
| **Corrections via chat** ("Actually 450") | ❌ New entry | ⚠️ Recognizes intent but needs backend | VERY HARD |
| **Duplicate detection** | ❌ Silent risk | ✅ Suggests merge | MEDIUM |
| **Ambiguity scoring** (confidence thresholds) | ⚠️ Fixed rules | ✅ Adaptive | HARD |
| **User personalization** | ❌ Static categories | ✅ Learns from audit log | HARD |
| **Proactive suggestions** | ❌ No patterns | ✅ With analytics | HARD |

---

## Recommended LLM Mode Prompts

When user has saved API key, use LLM with this system prompt:

```
You are a personal finance assistant. Your job is to extract expense entries 
from natural language. You understand:

- Multi-currency spending (convert to user's base currency)
- Ambiguous transaction boundaries (use semantic reasoning, not just commas)
- User's personal categories and recurring vendors
- Financial semantics: refunds, transfers, loans, reimbursables
- Bengali, English, Banglish language mixing
- Billing-period dates ("for July" = specific month, not today)

CONSTRAINTS:
- Use ONLY categories provided: {{ categories }}
- Date format: YYYY-MM-DD
- Confidence: 0-100%
- If refund/transfer/loan/shared: set semantic_type
- If amount ≤ 0 or invalid: reject

EXAMPLES:
"Lunch 300, tea 50 yesterday" → [expense, expense] same date
"Refund 500 from Agora" → [refund] semantic_type=refund
"Transferred 10000 to savings" → [] empty (not expense)
"Paid credit card 20000" → [] empty (payment, not expense)
"Kacchi 500" → category unknown without context, ask or guess
```

---

## Version Path

- **v1 (Current)**: Parser + preview, flags ambiguity with ⚠
- **v2**: LLM mode as Pro feature, learns from audit log
- **v3**: Per-user personalization, duplicate detection
- **v4**: Corrections via chat, event sourcing
- **v5**: Proactive suggestions, anomaly alerts
