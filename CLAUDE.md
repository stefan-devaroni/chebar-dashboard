# Che Bar — Context for Claude Code

This file is the handoff from a long strategy + build conversation in the Claude chat app. It contains everything Claude Code needs to continue work on this project coherently.

If you're Claude Code reading this for the first time: read this whole file before doing anything. Then check `supabase/master_plan.md` for the full task list and `README.md` for the dashboard project basics. Ask before making major architectural changes.

---

## Business overview

**Restaurant:** Che Bar
**Location:** Paseo Herencia Mall, Palm Beach, Aruba (Noord)
**Owner:** Stefan (operates LLC: Hard Money Holding Company). Has a co-owner and a manager who will also use the dashboard.
**Concept (post June 1 2026):** Dual identity
- **Che Bar Mornings** — brunch 7:30am-3pm. Dutch pancakes, empanadas, mimosas, espresso, breakfast specials. Cream/blue palette.
- **CLOSED 3-5pm**
- **Che Bar Nights** — 5pm to late. Happy hour 5-7, pizza 6-10:30, live music 7-9 four nights/week. Black/neon palette.

**Place IDs / external refs:**
- Google Place ID: `ChIJnefsMgQ4hY4RQTFkwIi19sM`
- TripAdvisor: 4.5★, 803 reviews, ranked #24 of 135 in Noord
- Google: 4.3★ (target: 4.5★ in 6 months)
- WhatsApp Business: +297 699 1696
- Email: info@chebararuba.com
- Domain: chebararuba.com

---

## Financial reality (Jan–Apr 2026)

- Revenue: ~$270,700 USD (AWG 484,553)
- Net margin: 3% (~$8,150 USD) — peak season barely profitable
- COGS: 39.8% (food 15.9%, liquor 13%, Aruba turnover taxes BAZV+BBO 7%)
- Payroll: 26.8%
- Rent: ~$7,700/mo USD (16.3% of revenue)
- Live music: ~$2,700/mo (4%)
- Marketing: ~$440/mo (0.65%) — **severely underspent**; target $1,000-1,500/mo

**POS data Jan–Apr 2026:** $277,603 USD across 7,885 transactions / 11,076 guests. Per-guest spend roughly flat across dayparts (~$25 average). Breakfast = 48% of sales, dinner = 43%, lunch = 9%.

**YoY:** Down ~11% vs Jan–Apr 2025. Explained by intentional menu simplification (cut burgers/sandwiches/smoothies = ~$25-30K removed) plus a new competitor across the street (likely "On The Rocks", 4.9★).

**Low season hole:** May–Sep 2025 only 10% below peak overall — but concentrated at 5-7pm (down 30-40% vs peak). The locals-focused 5-7pm offer + happy hour is meant to fill this.

**Live music ROI math:** Break-even at AWG 420-450 incremental revenue per night per musician at AWG 250 fee, assuming ~60% contribution margin on incremental drink/pizza mix. To test: track same-day-of-week with vs without music for 8 weeks.

---

## Strategic decisions made

These are settled — don't relitigate unless Stefan brings them up.

1. **June 1 simplification.** Menu and hours change on June 1. Operational clarity prioritized over revenue capture in the 3-5pm slot.
2. **Cut from menu:** Marinara pizza (low volume, 13 sold/4mo), Americana pizza (chicken supply chain issue).
3. **Repricing on June 1:**
   - Big Breakfast $14 → $16
   - French Toast & Fruit $11.50 → $13.50
   - Salmon, Cream Cheese & Capers bagel $14.75 → $16.50
   - Brie, Walnuts & Honey pancake $15.75 → $17
4. **Pizza + 2-for-1 cocktail combo** (Mon–Wed 6–8 PM only). House cocktail margin ~80% supports this.
5. **Locals 15% off** (May–Nov, low season only, show Aruba ID).
6. **3-5pm close** — Stefan chose operational simplicity over the marginal contribution; productivity SOP for staff during closure (prep/cleaning/content).
7. **Dual brand identity** — Mornings + Nights as distinct campaigns, distinct social aesthetics, distinct positioning. Mornings competes on differentiation (no direct brunch competitor); Nights competes on price/value vs neighboring 4.9★ venues.

---

## Brand & design system

- **Typography:** `Italiana` display serif (for headlines, matches existing logo) + `Inter` body
- **Colors:**
  - Mornings: cream `#f4f1ea` background, ink `#1a1a1a` text, gold accent `#d4a45c`
  - Nights: black background, white type, neon pink/cyan accents from existing menu graphics
- **Logo:** Thin inline serif "CHE BAR" wordmark (image asset, not a font we can match perfectly). Logo file should be in the dashboard `public/` folder eventually.
- **Voice:** Warm, human, specific. Never corporate. No "we strive to provide..." energy. Pancakes are pancakes, not "artisanal handcrafted Dutch pancake experiences."

---

## Tech stack

- **Next.js 14** App Router, TypeScript, strict mode
- **Supabase** — Postgres + Auth (email/password + magic link)
- **Tailwind CSS** — custom theme tokens for cream/ink/gold
- **Recharts** for any charts
- **Netlify** (paid plan) for hosting — Next.js Runtime plugin auto-detected
- **GitHub** for source
- **Anthropic API** for the review responder (Claude Sonnet 4.6)

Env vars expected:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, for seeding)
- `API_KEY_ANTHROPIC` — note the custom name; Stefan named it this way in Netlify, the code reads it as-is

---

## Project state

**Deployed and working:**
- `/login` — Supabase auth
- `/dashboard` — overview with task counts and recent completions
- `/dashboard/tasks` — full task browser, 258 seeded tasks across 7 categories
- `/dashboard/metrics` — placeholder page only
- `/dashboard/review-responder` — AI-powered review response generator (Anthropic API)

**Database (Supabase):**
- `categories`, `subcategories`, `tasks`, `task_activity` — all populated from `supabase/master_plan.md`
- `daily_metrics` — empty, awaiting entry UI
- `reviews_snapshot` — empty (Google Places API integration was built but parked)
- `reviews_individual` — schema not yet added (was part of the parked reviews tracking)

**Built but PARKED (files in repo but feature not deployed):**
- Google Reviews tracking — daily scheduled function + dashboard page. Parked because Stefan didn't want to set up the Google Cloud Console / Places API key. Can revive whenever — the SQL migration is in `supabase/reviews_migration.sql`.

---

## Open items / next steps

In rough priority order:

1. **Verify review responder works end-to-end.** The `API_KEY_ANTHROPIC` env var was just renamed. Stefan should test on `/dashboard/review-responder`.
2. **Lady B response.** There's an unanswered 1-star TripAdvisor review from March 2026 from a reviewer named "Lady B." Draft a thoughtful public response and post it on TripAdvisor.
3. **Hotel concierge one-pager.** Printable PDF for visiting nearby hotel concierges (Radisson Blu, Holiday Inn, Playa Linda, Marriott, Hyatt, RIU, Ritz-Carlton). Includes menu highlights, hours, parking, USP, 10% off mechanic.
4. **June 1 launch checklist.** Convert the menu/hours/POS changes into a concrete week-by-week countdown (~3 weeks out).
5. **Canva template specs.** Detailed design specs for the two master templates (Mornings + Nights) used by the social content library's Bulk Create workflow.
6. **QR review cards printed.** The HTML design is done. Stefan needs to order 5,000 cards from a local printer.
7. **Metrics page real implementation.** Daily revenue entry form + charts by daypart. Tables already exist in schema.
8. **Email/SMS list infrastructure.** Wi-Fi email gating, welcome series in Mailchimp.

---

## Stefan's style and communication preferences

- Often uses voice transcription, so messages may have "Um," verbal tics, casual grammar — read past the surface
- Prefers tiny actionable steps over big abstract plans. "Easy wins" matters to him
- Data-driven — will push back on shaky math, appreciates showing work
- Building this dashboard mostly solo, with a manager + co-owner who'll also use it
- Has done Python/ReportLab work before (tax reports) so he can handle code-adjacent tasks
- Tech setup: GitHub ✓, Netlify (paid) ✓, Supabase ✓, claude.ai web ✓. Has now decided to use Claude Code for project iteration going forward.
- One subtle thing: he doesn't always realize the distinction between Chat-Claude (file output, manual download) and Code-Claude (direct file edits, git operations). When in doubt, just act and tell him what you did rather than ask permission for routine file ops.

---

## Conventions for this codebase

- Don't bolt on dependencies casually. Stack has been kept lean intentionally.
- New dashboard pages follow the pattern in `app/dashboard/tasks/page.tsx`: server component fetches from Supabase, passes to a Client Component for interactivity.
- Use the `cn()` helper from `lib/utils.ts` for conditional Tailwind classes.
- Use `lucide-react` for icons. No emoji in UI.
- Color tokens: `bg-cream`, `text-ink`, `text-gold` (defined in `tailwind.config.ts`).
- Forms: gold focus outline, ink primary buttons, gold accent buttons for success/CTA states.
- Tasks are the source-of-truth for "what to do next." When Stefan asks for something, check if it's already a task; if so, link to it. If not, consider adding it via the dashboard rather than as ad-hoc code.

---

## How to verify your changes

For dashboard work:

```bash
npm run build    # must pass cleanly with no TS errors
npm run dev      # local check at http://localhost:3000
```

For database changes:

- Always write a migration SQL file in `supabase/` rather than editing the schema in the Supabase web console alone
- Test the SQL on a fresh Supabase project before applying to production

For deploys:

- Push to `main` triggers Netlify auto-deploy
- Netlify env vars are managed in Site configuration (not in git)
- The deploy fails fast if TypeScript breaks — check the build log first when something's off
