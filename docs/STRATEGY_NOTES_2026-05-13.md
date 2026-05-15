# Strategy Notes — 2026-05-13

> Summary of findings from a planning session covering: user feedback,
> path to global scale, cost structure, and a one-month task plan.
> Companion doc to [BUSINESS_PLAN.md](BUSINESS_PLAN.md) and
> [REFACTOR_ROADMAP.md](REFACTOR_ROADMAP.md).

---

## 1. User feedback that triggered this session

Two reactions from early sharing:

1. **"You should make an app."**
   → The web version already feels mobile-shaped. Users want it
   installable on their home screen.
2. **"I got stuck — there's no user journey."**
   → The zero-friction design (no signup, no onboarding) is a UX
   problem for non-technical users. They open the app and don't
   know what to do first.

Both are real, both are fixable, neither requires a rewrite.

---

## 2. Strategic direction — pick the right lane

| Lane A — Privacy-first utility *(recommended)* | Lane B — Real backend product |
|---|---|
| Stay local-first + optional Google Sheets | Add backend, auth, sync |
| Scales by **distribution**, not infra | Scales by **infra + features** |
| Revenue: donations, one-time unlock, Pro pack | Revenue: subscription, teams, families |
| Risk: ceiling on growth | Risk: become Mint/YNAB competitor |

**Decision:** Stay in Lane A. The pitches in
[PITCHES.md](PITCHES.md) only work in Lane A. Adding a backend
kills Pitch 4 (privacy) entirely.

---

## 3. Path to global scale (in order)

1. **Fix the "first move" problem** — empty state with one big CTA
   and tappable starter category chips. Not a tutorial — a *first move*.
2. **Finish the ES module refactor** — can't ship globally from a
   92 KB `app.js`. See [REFACTOR_ROADMAP.md](REFACTOR_ROADMAP.md).
3. **Ship as a PWA** — manifest + service worker. Optionally wrap
   with Capacitor for app stores later. No native rewrite.
4. **i18n scaffold** — start with English + Spanish/Portuguese/Hindi.
   Locale-aware dates, currency grouping, RTL support.
5. **Distribution** — landing page, SEO long-tail, Reddit, Product
   Hunt, Hacker News, partnerships. This is how local-first apps go
   global.
6. **Sustainability** — donations + one-time Pro Pack + optional
   encrypted sync. Never ads, never data sale, never bank linking.

The architecture is already correct for global scale. The hard
parts are UX onboarding and distribution, not engineering.

---

## 4. Cost structure (per tier, monthly)

The architecture means costs scale with distribution, **not with
user count**.

| Tier | Users | Infra cost | Est. revenue | Margin |
|---|---|---|---|---|
| 1 | 1K | $1–10 | $0–50 | break-even |
| 2 | 10K | $10–25 | ~$560 | ~95% |
| 3 | 100K | $60–160 | $5K–8K | ~97% |
| 4 | 1M | $900–1,000 | $50K–100K | ~98% |

**Year-1 committed spend: ~$1/month** (domain only). Everything
else is optional opt-ins (Plausible analytics, Resend email,
Stripe fees if Pro launches).

**The cost cliff:** the moment a self-hosted backend is added, costs
jump 10–50x. Database, backend host, backups, compliance, on-call.
A backend at 1M users could be $5K–15K/mo. Holding the "user owns
the data" line in section 12 of the business plan is what protects
this cost structure.

---

## 5. One-month task plan (~10–15 hrs/week)

### Week 1 — Fix the stuck-user problem
- Empty-state redesign with one big CTA + starter category chips.
- First-run hint strip (auto-hides after 3 entries).
- Slightly bigger confetti on first expense.
- Test with 2 real non-technical users. Watch silently.

**Exit:** 2 testers reach "first chart visible" without questions.

### Week 2 — Finish enough refactor to ship safely
- Move expense CRUD into [js/features/expenses/](../js/features/expenses).
- Move category CRUD into [js/features/categories/](../js/features/categories).
- Lock `SCHEMA_VERSION` and write migration stub in
  [js/core/schema.js](../js/core/schema.js).
- Expand [tests/smoke.html](../tests/smoke.html) into a 5-minute
  manual checklist (add/edit/delete/filter/theme/CSV).
- Kill at least one duplicate render path.

**Exit:** smoke checklist passes start-to-finish.

### Week 3 — Ship as an installable PWA
- `manifest.webmanifest` with icons (192/512/maskable).
- `service-worker.js` caching static shell + Chart.js CDN.
- Register SW from [js/main.js](../js/main.js) (prod only).
- "Install app" button using `beforeinstallprompt`.
- Test offline (airplane mode → log expense → refresh).
- Test iOS Safari "Add to Home Screen."

**Exit:** installs on Android Chrome, iOS Safari, desktop Chrome.
Works offline after first load.

### Week 4 — Landing page + one launch
- Separate landing page (app moves to `/app`).
- Hero, "what / why different / privacy" sections, FAQ.
- SEO basics: title, meta, OG image, sitemap, robots.
- Plausible on landing only (not the app).
- **Pick one launch:** Reddit `r/personalfinance` (recommended),
  Show HN, or 3 finance YouTubers. Not all three.

**Exit:** landing page live, 1 launch done, first feedback collected.

### Deliberately NOT in this month
- i18n / translations
- Capacitor / app store wrapping
- Pro tier / Stripe
- Recurring expenses, forecasting, family mode
- Custom theme builder
- Discord / community

---

## 6. Realistic end-of-month outcome

- App that non-technical users can actually start using.
- Modular codebase ready for continued growth.
- Installable mobile/desktop PWA.
- Landing page Google can index.
- First ~50–500 real users + actual feedback.

Foundation for everything in [BUSINESS_PLAN.md](BUSINESS_PLAN.md) Q2/Q3.

---

## 7. Principles to hold through all of this

1. **User owns the data.** Period.
2. **Core product is free, forever.** Pro adds depth, not gates.
3. **Privacy is a feature, not a marketing line.**
4. **One feature shipped > five features started.**
5. **No backend.** The architecture *is* the moat.

---

*Notes written: 2026-05-13. Companion to BUSINESS_PLAN.md.*
