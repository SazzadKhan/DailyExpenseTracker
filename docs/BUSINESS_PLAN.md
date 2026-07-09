# XpenseBot — Business Plan v2.3

> **Tagline.** *Type it like you'd text it. We handle the rest.*
>
> Privacy-first, local-first daily expense tracker for cash-first users.
> **One app.** Natural-language logging, charts, streaks, summaries,
> reminders — all inside the web app (installable as a PWA), all running
> in the user's browser, writing to the user's own Google Sheet.
> No bot, no companion apps, no servers.
>
> *v1 archived at [BUSINESS_PLAN.v1.md](BUSINESS_PLAN.v1.md). v2.1
> (bot-centrepiece) and v2.2 (bot-as-Pro-channel) are in git history.
> v2.3 written July 2026.*

---

## 1. Executive Summary

| | |
|---|---|
| **Core product** | One vanilla-JS web app (PWA), local-first, optional Google Sheets sync |
| **Key innovation** | Natural-language quick-add — `lunch 150, rickshaw 40, tea 20` parsed client-side |
| **Monetisation** | Free forever (logging + habit loop); Pro = a local chat assistant over your own data |
| **Privacy model** | No central DB, no servers, no held tokens. Data and OAuth never leave the user's browser + own Sheet. |
| **AI strategy** | Regex parser, client-side, improved on real parse-failure data before any LLM is considered |
| **12-month goal** | Retention first: 500 users logging on 20+ days per rolling 30-day window |
| **Launch geo** | Bangladesh + South Asia (cash-first users; YNAB structurally can't follow) |

**Status (July 2026).** Live on GitHub Pages. ES-module refactor done.
Next ship: sync data-loss fixes, then the quick-add box.

---

## 2. How the plan got here

- **v2.1 (May):** Telegram bot as centrepiece; Pro = the bot. Problem:
  a bot needs a server holding every user's OAuth tokens — a central
  credential store that breaks the privacy promise — and two months in,
  the bot had zero code and the founder had zero user contact.
- **v2.2 (early July):** parser moved into the free web app (client-side,
  no token custody); bot demoted to a Pro delivery channel, later.
- **v2.3 (now):** **the bot is cut entirely.** If the parser is the
  product, a second delivery channel is a second codebase, a hosting
  bill, a token-custody design, a Telegram platform dependency, and a
  Google sensitive-scope verification — all to re-deliver features one
  app already has. A solo founder maintains one product or zero.

**The v2.3 decision:** *one app does everything.*

What one-app buys:

- **Zero servers, permanently.** The privacy claim ("we don't have your
  data") is architectural fact, not policy. Nothing to host, secure,
  or pay for.
- **One codebase, one roadmap.** Every hour goes into the product users
  touch.
- **PWA = the mobile app.** Add-to-home-screen, offline-first (already
  true), full-screen. No app store, no second platform.

What one-app costs — stated honestly:

- **Reach.** The bot's one real advantage was pinging users without the
  app open. In v2.3, re-engagement leans on habit (streaks), on-device
  notifications where the installed PWA supports them (good on Android,
  weak on iOS), and in-app nudges. If retention data later shows we
  *must* reach users externally, that decision gets made with evidence
  and revenue — not assumed up front. (A minimal stateless push relay —
  which stores notification subscriptions, never financial data or
  tokens — is the fallback design, noted in §9.)

---

## 3. Product — one app, two layers

### 3.1  Free — the tracker and the habit loop (forever)

- **NL quick-add box:** `lunch 150, rickshaw 40, tea 20` → parsed items,
  amounts, categories, one-tap confirm. Client-side only. Front and
  centre on the first screen.
- One-tap logging (classic form remains); categories + subcategories
- Monthly / daily / category charts; budget bar with warning threshold
- Google Sheets sync (user-authorised OAuth, browser-side); CSV
  import/export
- **XP, streaks, daily in-app nudges** — the habit loop is free
- PWA install; 4 themes; haptics, micro-animations, confetti

### 3.2  Pro — a local chat assistant over your own data

Free tells you *what you spent*. Pro **talks to you about it** — a chat
panel inside the app, running entirely client-side. "Basic intelligence"
means a fixed grammar of intents over data the app already holds, built
on the same parser as quick-add. No LLM, no API, no data leaving the
browser.

| Capability | Example |
|---|---|
| Conversational logging | `lunch 150 and rickshaw 40` → logged, running total replied |
| Spending questions | `how much on food this month?` · `top category this week?` |
| Affordability check | `can I spend 500 today?` → answer from budget + month-to-date |
| Recall | `when did I last pay rent?` · `what did I log yesterday?` |
| Daily summary | End-of-day digest in the chat: totals, budget status, streak |
| Weekly report + grade | Spending grade A–F, trends vs. last week |
| Smart reminders | Evening nudge if no log today; budget alerts at 70%/90% (on-device where the platform allows) |
| Recurring templates | `log rent` → remembered amount; auto-suggested on schedule |

**Scope guard:** v1 ships with a fixed list of ~10 intents and a helpful
"I can't answer that yet" fallback that logs the miss (aggregate,
opt-out) — the miss log decides which intent ships next. A chat UI is a
scope monster if unfenced; the intent list is the fence. An *on-device*
model (WebGPU-class, still no server) is a year-2 experiment at most,
and only if intent-miss data proves the grammar has hit its ceiling.

Premium themes ride along as a cosmetic extra. The pitch is one
sentence: **"Free shows you the numbers. Pro answers when you ask."**
Nothing in Pro gates the habit loop; a free user can track forever and
never feel baited.

### 3.3  Parser strategy

**Now:** Regex/grammar parser, client-side. `<item> <amount>` lists with
optional currency, commas, "and", "for", Bengali/English mixed input and
Bengali numerals. Every parse failure logged (aggregate, opt-out) so the
grammar improves on evidence.

**Later:** disambiguation using the user's own historical category
mapping (still no LLM). The Pro chat assistant (§3.2) extends the same
grammar with *question* intents — one parser core, two surfaces. LLM /
on-device-model parsing remains a year-2 candidate, funded by revenue or
not at all.

**Validation this month:** 10 friends-and-family send one week of real
expense messages; the parser is tuned against that corpus by hand before
launch.

### 3.4  Competition

Splitwise, YNAB, expense bots, Notion templates all exist. The
defensible sentence: **privacy-first cash tracking for South Asia, in a
spreadsheet the user already owns, in the language they actually mix.**
YNAB assumes bank feeds and Western cards; bots and apps hold your data
on their servers. v2.3 sharpens the moat: this is now the only tool in
the category with *literally no backend* — there is nothing to breach,
subpoena, or sunset.

---

## 4. Retention

### 4.1  Data-loss mitigations (blocking, in progress)

Before any growth push:

- Fix the three confirmed sync bugs — [PLAN-LOST-LUGGAGE.md](PLAN-LOST-LUGGAGE.md)
  (rank 1: silent data loss), then [PLAN-FALSE-ALARM.md](PLAN-FALSE-ALARM.md)
  (spurious conflict dialogs) and [PLAN-STALE-PASS.md](PLAN-STALE-PASS.md)
  (sync dies after ~1 hour).
- Persistent "your data is only on this device" banner in guest mode.
- Automatic JSON backup download on day 7 if not signed in.
- Sheets sync surfaced in onboarding, not buried in settings.

### 4.2  XP system — free tier

XP rewards **financial behaviour**, not logging volume:

| Action | XP |
|---|---|
| Logged ≥1 expense today | +10 |
| Ended day within daily budget | +20 |
| 7-day streak bonus | +50 |
| 30-day streak bonus | +200 + theme unlock |

Saver tier (2,000+ XP) grants a **7-day Pro trial** — upselling the
insights layer to users who already have the habit.

### 4.3  Notifications — honest scope

- **In-app:** streak states, budget warnings, summary cards. Always
  available, free and Pro.
- **On-device (installed PWA):** Pro reminders where the platform
  supports local/scheduled notifications — reliable on Android, limited
  on iOS. The settings page says so plainly instead of overpromising.
- **Never:** daily pings without personalisation, notifications before a
  budget is set, guilt before day 3.

### 4.4  Retention is the year-1 KPI, not MAU

Unchanged: **500 users logging on 20+ days within a rolling 30-day
window** by month 12, measured with privacy-respecting aggregate
telemetry (opt-out, disclosed).

---

## 5. Business Model

### 5.1  Pricing — with an honest open problem

| Tier | Price | Includes |
|---|---|---|
| Free | $0 forever | Tracker, NL quick-add, XP/streaks, sync, charts, CSV, 4 themes |
| Pro | ~$2–4/mo or ~$20–35/yr — **price pending payments decision** | Local chat assistant: conversational logging, spending Q&A, summaries, weekly grade, reminders, recurring templates, premium themes |
| Supporter (one-time) | $10 | Badge + lifetime premium themes (not the insights layer) |

**⚠ Unresolved, blocking before Pro launch: how a person in Dhaka pays.**
Stripe does not operate in Bangladesh, and the target user is defined by
not living on cards. Candidates to evaluate on paper first: a
merchant-of-record serving BD cards/wallets (Paddle, LemonSqueezy —
verify BD support), bKash/Nagad merchant integration, or Google Play
billing via a TWA wrapper (now more attractive since v2.3 is PWA-first).
Price must be re-derived from local purchasing power — the $4 anchor is
a US number. **If no viable rail exists, the geo, the price, or the tier
changes — before launch, not after.**

Note: with no servers, Pro entitlement is a signed license key stored
client-side. Trivially crackable by a motivated dev — and explicitly not
worth fighting. People who pay for a privacy tool are paying to support
it; DRM would poison the brand for zero revenue.

### 5.2  What we will NEVER do

No selling user data (we don't have it), no ads, no bank-linking
middleware, no central database of user finances, **no servers holding
user tokens or financial data — period** (v2.3 makes this absolute; the
only possible exception, a stateless push relay, may hold notification
subscriptions only and requires a published design first).

### 5.3  Revenue tracks, ranked by realism

(A) Pro subscriptions, (B) one-time Supporter, (C) donations / GitHub
Sponsors — strengthened by the no-backend story, (D) white-label — year
2 only (now *more* plausible: a zero-infrastructure app is trivially
white-labelable), (E) disclosed affiliates.

### 5.4  The hobby question — founder must answer in writing

At realistic numbers (~$2K year 1) this is a side-business, not a
venture. The plan is only worth executing if this sentence gets
completed honestly:

> *"This is worth running at ~$2K year-1 revenue because ________."*

**Founder's answer:** *(unanswered as of July 2026 — answer before the
quick-add box ships. Both "because it's my product lab and community"
and "it isn't — this is a hobby and that's fine" are passing answers.
Leaving it blank is the only failing one.)*

---

## 6. Financial Projections

Assumptions: 150K cumulative visits year 1 (no "viral moment" line
item — luck is welcome but not budgeted), 2% visit→active, 1%
active→Pro, ARPU ~$25–40 depending on the §5.1 pricing outcome.

| Revenue stream | Year 1 (realistic) | Year 1 (stretch) | Year 2 (if traction) |
|---|---|---|---|
| Pro subscriptions | $1,000 | $3,500 | $18,000 – $45,000 |
| Supporter packs | $500 | $1,500 | $4,000 |
| Donations / Sponsors | $500 | $1,500 | $3,000 |
| White-label | $0 | $0 | $10,000 – $25,000 |
| **Total** | **~$2,000** | **~$6,500** | **~$35,000 – $75,000** |

| Cost | Year 1 |
|---|---|
| Domain + Cloudflare | ~$15 |
| Payment-rail fees | unknown until §5.1 resolves (bKash/MoR ≠ Stripe's 2.9%) |
| Privacy analytics (Plausible) | ~$120 |
| Hosting | **$0 — GitHub Pages, no backend** |
| **Total** | **<$250** |

The v2.3 cost structure is the quiet superpower: at zero marginal cost,
*any* revenue is profit, and the app can idle indefinitely without
bleeding — which matters for a founder who has already burned out once.

---

## 7. Go-To-Market

**Positioning.** *"The expense tracker with no server to trust. Your
notes, your Sheet, your language."*

### 7.1  One channel, and it doubles as the founder's community

Year-1 channel: **Telegram + Reddit communities in Bangladesh and South
Asia.** Joining starts **now**, before launch — lurking, answering
budgeting questions, asking how people track cash today. This is
simultaneously the marketing channel, the parser-input research, and the
founder's missing support network. Solo building without one already
caused one burnout; community contact is a work item, not a
nice-to-have.

**Kill criterion (clock starts at quick-add launch):** 200 signups and
50 week-4-retained users within 60 days. If missed, reassess before
opening a second channel.

**Second channel (only after #1 validates):** Show HN — and "no backend,
open source, your own Sheet" is a genuinely strong HN story.
**Year 2:** SEO content operation, white-label.

### 7.2  Activation funnel

```
Discover via community → Visit site → Quick-add box on first screen
                                              ↓
                First expense parsed within 5 minutes  (north-star: >40%)
                                              ↓
              Day 3: Sheets sync prompt → streaks build (free)
                                              ↓
              Saver tier reached → 7-day Pro trial → Pro conversion
```

---

## 8. Roadmap (12 months from July 2026)

One person, one app, three things at a time, user contact every week.

### Now → month 2 — Trust + the product
- Ship sync data-loss fixes (PLAN-LOST-LUGGAGE, then FALSE-ALARM,
  STALE-PASS)
- **Quick-add box** (client-side parser + confirm UI + parse-failure
  logging)
- 10 friends-and-family on it for a week; parser tuned on their real
  messages
- Founder joins 3–5 BD/SEA Telegram/Reddit communities
- Written answers: payments paragraph (§5.1), hobby sentence (§5.4)

### Months 3–4 — Launch into one channel
- Landing page: quick-add front and centre
- XP + streaks live (free tier)
- PWA manifest + install prompt (add-to-home-screen)
- Privacy-respecting analytics (opt-out, aggregate)
- Community launch. **Kill-criterion clock starts.**

### Months 5–7 — Pro build (only if kill criterion passes)
- Insights engine: daily summary + weekly grade (client-side, pure
  functions — the chat assistant's brain)
- **Chat assistant v1:** chat panel + ~10 fixed intents over the
  insights engine + intent-miss logging
- Smart reminders (on-device, honest platform-support copy)
- Recurring templates
- Payment rail integrated per §5.1 findings
- Pro private beta: 20 users, real payment, real feedback

### Months 8–12 — Revenue validation
- Public Pro launch (price set by §5.1)
- Monthly insights; Saver-trial pipeline live
- Show HN (only with real retention numbers)
- **Decision point:** continue, hire part-time help, or declare it a
  hobby. Honest answer either way.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Regex parser fails on real input | Medium | High | 10-user corpus **before** launch; parse-failure logging after |
| Chat assistant scope creep | High | Medium | Fixed ~10-intent list + miss logging (§3.2); new intents only from miss data |
| localStorage data loss → negative WOM | High | High | PLAN-LOST-LUGGAGE ships first; day-7 auto-backup; banner |
| **No viable payment rail in BD** | **Medium** | **High** | **Resolve §5.1 on paper before any Pro build; change geo/price/tier if needed** |
| **Solo founder burnout / isolation** | **High (occurred July 2026)** | **High** | Weekly user contact as a work item; community from month 1; zero-cost architecture means pausing is always safe |
| **No external reach channel hurts retention** | Medium | High | Streak psychology + on-device notifications first; if data proves external push is required, design the stateless push relay (subscriptions only, no financial data, published design) — decided on evidence, not assumption |
| iOS PWA notification limits | High | Medium | Honest settings copy; iOS users get in-app nudges; don't build features that pretend otherwise |
| Bigger player copies it | Medium | Medium | Own the §3.4 sentence; open source trust; "no backend" is hard for incumbents to copy honestly |
| Google Sheets API / OAuth scope changes | Low–Med | High | Storage layer already abstracted; CSV export always available |
| Pro conversion < 0.5% | Medium | Medium | Plan must survive ~$2K year 1 — §5.4 answers whether that's acceptable |

---

## 10. The North Star

**Mission.** Help cash-first users see where their money goes — without
asking for their bank, their identity, or their data.

**Vision.** *Be the default answer when someone asks "is there a
budgeting app that isn't trying to sell me something?"*

**Three principles that don't move:**

1. **The user owns the data.** Data lives in their Google Sheet. We are
   the plumbing, not the vault. v2.3 makes this absolute: there is no
   backend at all.
2. **The core product is free, forever — including the habit loop.**
   Pro sells understanding and automation, never the features that make
   tracking work.
3. **Privacy is a feature, not a marketing line.** If we must choose
   between revenue and privacy, privacy wins. (This is why the bot is
   gone.)

---

*Plan v2.3 written: July 2026 (supersedes v2.2 — in git history).
Revisit: after the 10-user parser week, or October 2026, whichever comes
first. Kill-criterion review: 60 days after quick-add launch.*
