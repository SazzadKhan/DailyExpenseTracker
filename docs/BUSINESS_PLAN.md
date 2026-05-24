# XpenseBot — Business Plan v2.1

> **Tagline.** *Tell your Telegram what you spent. We handle the rest.*
>
> Privacy-first, local-first daily expense tracker with an optional
> Telegram bot for natural-language logging. Free web app forever;
> paid bot tier for users who want frictionless logging from their
> messaging app.
>
> *v1 plan archived at [BUSINESS_PLAN.v1.md](BUSINESS_PLAN.v1.md).
> v2.1 supersedes the v2 mentor-review draft.*

---

## 1. Executive Summary

| | |
|---|---|
| **Core product** | Vanilla-JS expense tracker, local-first, optional Google Sheets sync |
| **Key innovation** | Telegram bot — log expenses by sending a natural-language message |
| **Monetisation** | Free forever (web); Pro ($4/mo) unlocks the Telegram bot |
| **Privacy model** | No central DB. User data lives in their own Google Sheet. |
| **AI strategy** | Regex parser ships v1 (no API key needed). LLM is Pro-Plus, later. |
| **12-month goal** | 5,000 MAU, 100 Pro subscribers, validated retention |
| **Launch geo** | Bangladesh + South Asia first (where Telegram + bot novelty land) |

**Status (May 2026).** Live on GitHub Pages. Mid-refactor to ES modules.
Bot does not exist yet — Q1 deliverable.

---

## 2. The Pivot, And Why

The v1 plan had three structural weaknesses surfaced in mentor review:

1. **"Free forever" branding undermined Pro tier conversion** — paying
   users would feel baited.
2. **Manual logging friction** killed retention before habit formation.
3. **Pro features were weak** — extra themes and templates aren't a
   reason to pay.

The pivot resolves all three with one decision:

> **Make the Telegram bot the centrepiece of the product, and the entire
> reason Pro exists.**

This works because:

- **Friction eliminated.** Users text the bot the way they text a friend.
  No app to open.
- **Behavioural fit.** Logging happens where users already are.
- **Privacy intact.** Bot writes to the user's own Google Sheet.
- **Pro is obvious.** "Pay $4 to log expenses by texting" is a sentence
  a human can repeat.

### What changed from the v2 draft

The v2 draft asked Pro users to bring their own AI API key. That's a
fatal funnel — expect ~25% completion of paying users who clicked
"subscribe." v2.1 ships a **regex parser** for the bot's v1, which
handles 95%+ of real-world inputs (`lunch 150, rickshaw 40, tea 20`)
without any LLM. LLM-backed parsing becomes a Pro-Plus tier later, once
we have revenue to fund inference or a real reason to push BYO-key
again.

---

## 3. Product

### 3.1  Free Tier (Web App) — stays free forever

- One-tap expense logging
- Categories + subcategories, fully editable
- Monthly / daily / category charts
- Budget bar with warning threshold
- Google Sheets sync (user-authorised OAuth)
- CSV import / export
- 4 themes: Dark, Panda, Peaceful, Edgy
- Haptics, micro-animations, confetti

### 3.2  Pro Tier — the Telegram Bot ($4/mo or $35/yr)

Pro is not a feature-locked web app. It's a different interaction
paradigm entirely.

| Feature | What it does |
|---|---|
| Natural-language logging | `lunch 150, rickshaw 40, tea 20` — parsed and written to your Sheet |
| Inline confirmation | Bot replies with parsed items + running total |
| One-tap correction | Reply `fix rickshaw → Transport` to recategorise |
| Daily summary | End-of-day digest: totals, budget status, streak |
| Weekly report + grade | Spending grade A–F based on budget adherence |
| Smart reminders | Evening nudge if no log that day |
| XP + streak via bot | Gamification events delivered as Telegram messages |

### 3.3  Parser strategy

**v1 (Q1):** Regex/grammar parser. Handles `<item> <amount>` lists with
optional currency, commas, "and", "for", common Bengali/English mixed
input. No external dependency, no API key, no inference cost. Ships in
a weekend.

**v1.5 (Q3 if needed):** Add a small disambiguation layer for ambiguous
inputs (`coffee` → which subcategory?). Still no LLM — uses the user's
historical category mapping.

**Pro-Plus (year 2 candidate):** LLM-backed parsing for receipts,
free-form descriptions, multi-language input. Either we eat the cost on
a metered tier or revisit BYO-key when we have a base of believers who
will tolerate the setup.

### 3.4  Platform: Telegram first

| Factor | Telegram | WhatsApp |
|---|---|---|
| Bot API | Free, instant | Meta Business — paid, approval |
| Dev friction | Weekend | Weeks of compliance |
| Privacy reputation | Strong | Meta-owned |

WhatsApp is a Phase 2 question, only if Telegram shows real retention.

---

## 4. Retention

The biggest failure mode of v1 was data loss: a guest-mode user clears
their browser, loses everything, blames us. **These ship before any
growth push.**

### 4.1  Data-loss mitigations (Q1, blocking)

- Persistent "your data is only on this device" banner in guest mode.
- Automatic JSON backup download on day 7 if not signed in.
- Monthly export reminder toast.
- Sheets sync setup surfaced as the second screen of the onboarding
  tour, not buried in settings.

### 4.2  XP system

XP rewards **financial behaviour**, not logging volume. Logging 50 tiny
expenses to farm points should feel hollow.

| Action | XP |
|---|---|
| Logged ≥1 expense today | +10 |
| Ended day within daily budget | +20 |
| Replied to bot summary | +5 |
| 7-day streak bonus | +50 |
| 30-day streak bonus | +200 + theme unlock |

| Level | XP Range | Perk |
|---|---|---|
| Beginner | 0 – 500 | — |
| Tracker | 500 – 2,000 | — |
| Saver | 2,000 – 5,000 | 🌟 7-day free Pro trial |
| Pro Saver | 5,000+ | Supporter badge + exclusive theme |

The **Saver-tier free trial is the XP→Pro pipeline.** It converts
gamification from cosmetic into a direct acquisition funnel.

### 4.3  Notifications

All delivered via Telegram (Pro) or in-app toast (free). No browser
push. The Telegram inbox is the only place we can reliably reach a user
without permission friction.

**Ship these:** streak congratulations, budget checks at 70%/90%,
weekly grade, gentle re-engagement after 3+ silent days.

**Never ship:** daily pings without personalisation, notifications
before a budget is set, guilt before day 3.

### 4.4  Retention is the year-1 KPI, not MAU

Success metric: **500 users logging expenses on 20+ days within a
rolling 30-day window** by month 12. This matters more than visits or
star count. It requires privacy-respecting telemetry on the app itself
(Plausible-style, aggregate-only, opt-out — disclosed in the privacy
page).

---

## 5. Business Model

### 5.1  Pricing

| Tier | Price | Includes |
|---|---|---|
| Free | $0 forever | Full web app, Sheets sync, charts, CSV, 4 themes |
| Pro | $4 / mo or $35 / yr | Telegram bot, NL logging, summaries, reminders, weekly grade |
| Supporter (one-time) | $10 | Badge, all current premium themes |

### 5.2  What we will NEVER do

- Sell user data. We don't have it.
- Run ads.
- Bank-linking middleware.
- Anything that requires a central database of user finances.

### 5.3  Revenue tracks, ranked by realism

| Track | Source | Realism |
|---|---|---|
| A | Pro subscriptions | Primary — validated by bot value |
| B | One-time Supporter purchase | Easy conversion at moment of delight |
| C | Donations / GitHub Sponsors | Low ceiling, zero overhead |
| D | White-label / B2B2C licensing | **Year 2 only.** Not in year-1 scope. |
| E | Selective affiliates (disclosed) | Only products we'd recommend |

White-label was a year-1 distraction in v1. Deferred to year 2 where it
belongs.

---

## 6. Financial Projections

**Realistic assumptions** (downgraded from v1/v2 optimism):

- 150K cumulative unique visits in year 1 (SEO + Telegram + 1 viral moment)
- **2% visit→active** (industry-realistic for a utility tool with no brand)
  → ~3,000 active users
- **1% active→Pro** (achievable because the bot is the upsell, not gated themes)
  → ~30 paying users by month 12
- ARPU on Pro: ~$40/yr

| Revenue stream | Year 1 (realistic) | Year 1 (stretch) | Year 2 (if traction) |
|---|---|---|---|
| Pro subscriptions | $1,200 | $4,000 | $20,000 – $50,000 |
| Supporter packs | $500 | $1,500 | $4,000 |
| Donations / Sponsors | $500 | $1,500 | $3,000 |
| White-label | $0 | $0 | $10,000 – $25,000 |
| **Total** | **~$2,200** | **~$7,000** | **~$40,000 – $80,000** |

| Cost | Year 1 |
|---|---|
| Domain + Cloudflare | ~$15 |
| Stripe fees | ~$70 (2.9% + $0.30/txn) |
| Privacy analytics (Plausible) | ~$120 |
| Telegram bot hosting (free tier, fly.io / Railway) | $0 |
| **Total** | **<$250** |

**Honest framing.** At realistic numbers this is a side-business in
year 1, not a venture. The plan must be worth running at ~$2K
year-1 revenue. If it isn't, this is a hobby — and that's an honourable
choice, just be clear about it.

---

## 7. Go-To-Market

**Positioning.** *"The expense tracker that doesn't want anything from
you — except a Telegram message."*

### 7.1  One channel, then the next

Multi-channel from zero with no team is how solo founders end up with
200 visitors from six places and no learnings.

**Year-1 launch channel: Telegram + Reddit communities in Bangladesh
and South Asia.**

Why:
- Telegram penetration is high; the bot angle is novel there.
- Founder can speak directly to the audience.
- Cheap, fast feedback loop. No DR-70 SEO competition.

**Kill criterion.** If this channel does not produce **200 signups and
50 retained users (active in week 4)** within 60 days of bot launch,
reassess before opening a second channel.

**Second channel (only after #1 validates):** Show HN. One shot, prepare
the README and demo for two weeks.

**Deferred to year 2 unless revenue justifies a part-time writer:**
SEO content operation. It's an 18–24 month compounding play and
requires content-business muscle the team doesn't have.

### 7.2  Activation funnel

```
Discover via Telegram community  →  Visit site  →  Add 1 expense in web app
                                                            ↓
                              Day 3: Sheets sync prompt  →  Day 7: bot trial offer
                                                                       ↓
                                              Week 4: retained  →  Pro conversion
```

The **single most important metric** is "first expense logged within 5
minutes of arrival." Optimise nothing else until this is consistently
above 40%.

---

## 8. 12-Month Roadmap

Cut to what one person can actually ship.

### Q1 — Foundation (3 deliverables, not 6)
- Finish ES module refactor
- Data-loss mitigations (banner, auto-backup, onboarding-tour OAuth)
- Telegram bot MVP with regex parser → writes to user's Google Sheet

### Q2 — Launch into one channel
- Landing page that puts the bot front and centre
- XP system + streak tracking (web app side)
- Telegram + Reddit BD/SEA launch
- Privacy-respecting in-app analytics (opt-out, aggregate)
- **Target:** 200 signups, 50 week-4-retained users

### Q3 — Depth (only if Q2 kill criterion passes)
- Weekly grade via Telegram
- Recurring expense templates via bot
- Saver-tier 7-day Pro trial pipeline live
- Pro private beta: 20 users, real payment, real feedback
- README rewrite + GitHub Sponsors page

### Q4 — Revenue validation
- Public Pro launch at $4/mo
- Show HN launch (only if Q3 has real retention numbers)
- **Decision point:** continue solo, hire part-time content writer, or
  declare it a hobby. Honest answer either way.

WhatsApp, white-label, and the SEO content engine are all year 2.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Regex parser fails on real input | Medium | High | Ship to 10 friends-and-family first; iterate before public launch |
| localStorage data loss → negative WOM | High | High | **Day-7 auto-backup + persistent banner (Q1 blocking)** |
| Telegram bans bot or changes API | Low | High | Web app is independent; WhatsApp as Phase 2 fallback |
| Bigger player copies the bot | Medium | Medium | Brand + open source trust + iteration speed |
| Solo founder burnout in Q3 | Medium | High | Cut Q1 to 3 items; defer SEO/white-label to year 2 |
| BD fintech regulatory attention | Low | Medium | We don't move money or hold accounts. Add one-paragraph compliance page. |
| Pro conversion < 0.5% | Medium | Medium | Plan must survive ~$2K year-1 revenue. If it doesn't, this is a hobby — own it. |
| Google changes Sheets API/OAuth scopes | Low–Med | High | Abstract storage layer; CSV export always available |

---

## 10. The North Star

**Mission.** Help one billion people see where their money goes —
without asking for their bank, their identity, or their money.

**Vision.** *Be the default answer when someone asks "is there a
budgeting app that isn't trying to sell me something?"*

**Three principles that don't move:**

1. **The user owns the data.** Period. Data lives in their Google
   Sheet. We are the plumbing, not the vault.
2. **The core product is free, forever.** Pro adds a different
   interaction paradigm. It does not gate features that should just
   exist.
3. **Privacy is a feature, not a marketing line.** If we must choose
   between revenue and privacy, privacy wins.

---

*Plan v2.1 written: May 2026. Revisit: August 2026.
Kill-criterion review: 60 days after bot launch.*
