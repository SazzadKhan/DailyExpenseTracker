# Daily Expense Tracker — Business Plan

> A grounded plan for a free, privacy-first, no-backend expense tracker.
> The product is already built and shipping on GitHub Pages. This doc is
> about turning it into something with users, traction, and (eventually)
> revenue — *without* compromising the things that make it special.

---

## 1. Executive Summary

**Product.** A vanilla-JS, local-first daily expense tracker with optional
Google Sheets sync. Multiple themes, charts, CSV import/export, premium
feel. No backend, no account system, no analytics. The user owns their
data — literally; it lives in their browser or their own Google Drive.

**Tagline.** *See your money. Privately. For free.*

**Unique angle.** Most "free" finance apps are free *now* and locked
*later*. We're free *forever* because we don't run servers — there's
nothing to charge for. Revenue, if and when it comes, will be from
optional power-user features (templates, premium themes, advanced
analytics), donations, and white-label licensing.

**Status (as of this writing).** Live at GitHub Pages on the
`GitHub_Pages_Google_Sheets` branch. Multi-theme, OAuth Sheets sync,
custom dialog system, mid-refactor to ES modules.

**12-month goal.** 10,000 active users, top-3 result on Google for
"free expense tracker no signup", and a clear paid-tier hypothesis
validated by a small set of believers.

---

## 2. Problem & Why Now

**The problem.** People don't know where their money goes. The apps
that promise to solve this:

- Charge a monthly fee (YNAB, Copilot, Monarch).
- Lock real features behind paywalls (Mint successors, Rocket Money).
- Require bank linking and an account (everything in the category).
- Have ugly UX, dead UX, or both (most free spreadsheets).
- Got shut down (Mint, Wallet by BudgetBakers in some regions, etc.)
  and took user trust with them.

**Why now.**

- Mint's shutdown left a giant trust vacuum in the budgeting space.
- Privacy is going from "niche concern" to "default expectation."
- Static-hosted PWAs are finally good enough to feel like real apps.
- Google Sheets is everywhere, free, and trusted as a data store.
- Subscription fatigue is real. People are *tired* of recurring fees
  for features that should just exist.

---

## 3. Product

**Core experience.**

- One-tap expense log from anywhere on the page.
- Categories + subcategories (fully editable; quick-add from the log popup).
- Recent activity, monthly/daily/category charts.
- Budget bar with warning threshold.
- Custom in-app dialog system (no native browser popups).
- Premium feel — haptics, sound, ripple, confetti, micro-animations.

**Storage modes.**

- **Guest mode.** Everything stays in `localStorage`. Zero account.
- **Signed-in mode.** Per-user OAuth to a private Google Sheet on
  the user's own Drive. One sheet per user. No central DB.

**Themes.** Dark, Panda, Peaceful, Edgy.

**What's deliberately *not* there.**

- No bank linking. (Compliance nightmare, trust risk, dependency hell.)
- No social features. (Money is private. Always.)
- No central server. (Nothing to leak, nothing to bill, nothing to scale.)
- No accounts. (Sign in is optional and uses Google directly.)

---

## 4. Market

**TAM (high-level).** Anyone with money. ~3B+ adults globally with
smartphones and discretionary spending. Practically: addressable
English-speaking market is in the 500M+ range.

**SAM (realistic).** People actively searching for a budgeting tool
who:
- want it free
- don't want to link their bank
- are willing to use a web app or PWA
This is millions — every "Mint alternative" Reddit thread proves it.

**SOM (year 1).** Top-of-funnel target: 250K visits. Activation
target: 10K active users (define active = at least 5 expenses logged
in last 30 days).

---

## 5. Competition

| Competitor | Strength | Weakness | Our angle |
|---|---|---|---|
| **YNAB** | Loyal cult, great philosophy | $99/yr, steep learning curve | Free, zero-onboarding |
| **Copilot / Monarch** | Beautiful, bank-linked | $8-15/mo, iOS-first, US-centric | Free, web-first, no banks |
| **Mint (rip)** | Was the default | Shut down, broke user trust | "Nothing to shut down" |
| **Rocket Money** | Subscription-cancel angle | Aggressive upsells | No upsells, no fees |
| **Google Sheets templates** | Free, customizable | Friction, no UX, no charts | All the data ownership, none of the UX pain |
| **Notion templates** | Pretty | Slow, requires Notion account | Faster, lighter, no account |

**Defensibility.** Not features — features get copied. Defensibility
comes from:

1. **Brand stance.** "We literally don't have your data." Hard to
   counter once you've committed to it.
2. **Static-host cost structure.** We can serve millions for ~$0.
3. **Community trust.** Open source, audit-friendly code.
4. **Speed of iteration.** No backend means no migrations, no
   downtime, no DB schemas. Ship in hours, not sprints.

---

## 6. Business Model

The product stays free. Forever. That's the promise.
But "free product" ≠ "no business." Here are five revenue tracks,
ranked by realism and ethical fit:

### Track A — Optional "Pro" tier ($3-5/mo or $25/yr)
*Most realistic. Validate first.*

What goes in Pro:
- Recurring expense templates / auto-log
- Custom theme builder + extra premium themes
- Multi-currency aware analytics (per-trip budgets, etc.)
- Bulk CSV transforms / "smart" import
- Forecasting & "what if" projections
- Family / shared sheet mode (multiple Google accounts to one sheet)

What stays free **forever**: every core feature already shipping
today. No degradation of the free product. The line is "useful for
power users", not "needed by everyone."

### Track B — One-time "Support the dev" purchase ($10-15)
Unlocks a "Supporter" badge, all current premium themes, and a warm
fuzzy feeling. Frictionless conversion at the moment a user falls in
love with the app.

### Track C — Donations / sponsorships
GitHub Sponsors, Buy Me a Coffee, Open Collective. Low ceiling but
zero overhead. Good for year-one signal.

### Track D — White-label / B2B2C licensing
Credit unions, financial literacy nonprofits, HR wellness programs,
and personal-finance content creators all need a clean
"recommended tracker" they can co-brand. We license the codebase
(or a hosted instance with their logo) for a flat annual fee.

### Track E — Affiliate partnerships *(with strict rules)*
Highly selective. Only products we'd actually recommend (e.g.,
high-yield savings accounts, ad-free budgeting books). Disclosed
inline. No dark patterns. **No selling user data — there's none to sell.**

### What we will NOT do (ever)
- Sell user data. (We don't have it.)
- Run ads.
- Bank-linking middleware.
- Anything that requires us to host a database of user finances.

---

## 7. Go-To-Market

**Positioning.** "The expense tracker that doesn't want anything from you."

**Acquisition channels, ranked:**

1. **SEO + content.** Long-tail keywords are gold here:
   - "free expense tracker no signup"
   - "Mint alternative no bank linking"
   - "private budget app"
   - "Google Sheets budget template that doesn't suck"
   Write 20-30 honest, useful posts. Rank for a year. Compound.
2. **Reddit.** `r/personalfinance`, `r/ynab` (carefully),
   `r/privacy`, `r/selfhosted`, `r/budget`, `r/digitalminimalism`.
   Don't spam. Show up, answer questions, link only when relevant.
3. **YouTube + TikTok.** Short demos. "I made an expense tracker
   in vanilla JS — here's why it's better than Mint." The dev
   angle gets engineers. The product angle gets normies.
4. **Product Hunt launch.** Time it for after the redesign +
   onboarding polish. One shot, do it right.
5. **Hacker News.** "Show HN: A privacy-first expense tracker
   with no backend." Engineering audience appreciates the
   stack. Risk is high but signal too.
6. **Open source flywheel.** The repo is the marketing. Make the
   README excellent. Star count = social proof = downloads.
7. **Partnerships.** Personal finance YouTubers and bloggers who
   are already anti-subscription. Send them the app. Let them
   roast or rave honestly.

**Activation funnel.**

```
Visit  →  See live demo on page  →  Add first expense  →  See chart  →  Bookmark
                                                                  ↓
                                Day 7 return  →  Sign in for sync  →  Loyal user
```

The single most important metric is **first expense logged**. If we
can get to "they tried it" in under 30 seconds from landing page,
we win.

---

## 8. Roadmap (12 months)

**Q1 — Foundation (now)**
- Finish ES module refactor (in progress).
- Custom dialog system (✅ shipped).
- Store-wired expenses (✅ shipped).
- Onboarding tour ("3 expenses to see how it works").
- Polished landing page (separate from app for SEO).
- README rewrite for stars.

**Q2 — Reach**
- PWA install + offline.
- iOS / Android wrappers (PWA-based, no native rewrite).
- 10 SEO blog posts published.
- Reddit + HN + Product Hunt launches.
- First 1,000 daily active users.

**Q3 — Depth**
- Recurring expenses & templates (free for now).
- Multi-currency improvements.
- Forecasting / "what if" charts.
- Begin Pro tier private beta with 50 power users.
- First "Buy me a coffee" / Sponsors page.

**Q4 — Validate revenue**
- Public Pro launch ($3-5/mo).
- White-label outreach to 5 nonprofits + 5 credit unions.
- 10K MAU target.
- Decide: keep solo, hire 1 contractor, or stay lean.

---

## 9. Operations & Team

**Today.** One developer (you), no employees, no contractors.

**12-month structure (if Pro validates).**

- You: product, code, brand, vision.
- Part-time content writer (~10 hrs/week) for SEO articles.
- Part-time community manager (~5 hrs/week) for Reddit / Discord.
- That's it. The whole point is staying lean. Static hosting +
  optional Stripe + Cloudflare = entire infra bill under $50/mo
  at 10K users.

**Tools.** GitHub (code + Pages), Cloudflare (DNS + DDoS), Stripe
(if/when Pro launches), Plausible or Umami (privacy-respecting
analytics on the *marketing* site only — not the app itself).

---

## 10. Financial Projections (rough, year 1)

Assumptions:
- 250K cumulative unique visits (achievable with SEO + 2-3 viral moments).
- 4% activation to "real user" → 10,000 MAU.
- 1.5% of active users convert to Pro at $4/mo → 150 paid users.
- Average revenue per paying user: ~$45/yr.

| Stream | Year 1 | Year 2 (if traction) |
|---|---|---|
| Pro subscriptions | $6,750 | $30,000-60,000 |
| One-time supporter packs | $2,000 | $5,000 |
| Donations / Sponsors | $1,500 | $3,000 |
| White-label deals (1-2 in year 2) | $0 | $10,000-25,000 |
| **Total** | **~$10K** | **~$50-100K** |

**Costs (year 1):** under $1K. Domain, Stripe fees, some ads as
experiments. Static hosting is free. No salaries (founder runs lean).

This is not a venture-scale business in year 1. **That's the point.**
It's a sustainable, principled product that can grow without
compromising what it stands for.

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nobody uses it | Medium | High | SEO + content compounding; aggressive Q2 launch |
| Pro tier flops | Medium | Medium | Donations + white-label as backup tracks |
| Google changes Sheets API or OAuth scopes | Low-Med | High | Abstract storage layer; CSV export = always portable |
| Bigger player copies us | Medium | Medium | Brand + open source + speed of iteration |
| Burnout (solo founder) | Medium | High | Stay lean, hire help once revenue justifies it, keep scope small |
| Browser deprecation of features we use | Low | Low-Med | Vanilla JS = fewer dependencies, easier to keep current |

---

## 12. The North Star

**Mission.** Help one billion people see where their money goes —
without ever asking for their bank, their identity, or their money.

**One-line vision.** *Become the default answer when someone asks*
*"is there a budgeting app that isn't trying to sell me something?"*

**Three principles that don't move:**

1. **The user owns the data.** Period. No exceptions.
2. **The core product is free, forever.** Pro adds depth, not gates.
3. **Privacy is a feature, not a marketing line.** If we have to
   choose between revenue and privacy, privacy wins.

If we hold those three lines, the rest will follow.

---

*Plan written: 2026-05-12. Revisit quarterly.*
