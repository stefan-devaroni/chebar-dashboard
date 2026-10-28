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
   - **UPDATE Jul 2026 (confirmed by Stefan): the Americana was NOT removed — it's still on the menu and selling.**
   - **Oct 15 2026 (Stefan): the menu has NOT changed yet. The printed Nights menu still has 9 pizzas including Americana (Marinara is gone). A smaller 4-pizza menu is planned (see the handoff section below) but not launched.**
3. **Repricing on June 1:**
   - Big Breakfast $14 → $16
   - French Toast & Fruit $11.50 → $13.50
   - Salmon, Cream Cheese & Capers bagel $14.75 → $16.50
   - Brie, Walnuts & Honey pancake $15.75 → $17
   - **UPDATE Jul 2026 (confirmed by Stefan): these price increases were NOT implemented — Big Breakfast still sells at the old price (POS avg ~$14.80). Treat the whole June 1 plan above as "planned, partially executed" and verify against POS data before citing any of it.**
4. **Pizza + 2-for-1 cocktail combo** (Mon–Wed 6–8 PM only). House cocktail margin ~80% supports this.
   - **UPDATE Jul 2026 (confirmed by Stefan): never launched.**
5. **Locals 15% off** (May–Nov, low season only, show Aruba ID).
6. **3-5pm close** — Stefan chose operational simplicity over the marginal contribution; productivity SOP for staff during closure (prep/cleaning/content).
   - **UPDATE Jul 2026 (confirmed by Stefan): did not happen — open continuously 7:30 AM–11 PM daily.**
   - **Re-confirmed Oct 15 2026: still open all day, 7:30 AM–11 PM. An Oct 2026 handoff doc from the chat app says "Closed 3–5 PM daily" — that line is outdated; ignore it.**

> **Reality check (Jul 2026):** of the June 1 plan, only the menu simplification (evening menu reduced to pizza; burgers/wings/etc. cut) actually shipped. The reprices, Americana removal, 3–5 close, and pizza combo did NOT happen. Verify against POS before citing any planned change as fact.
7. **Dual brand identity** — Mornings + Nights as distinct campaigns, distinct social aesthetics, distinct positioning. Mornings competes on differentiation (no direct brunch competitor); Nights competes on price/value vs neighboring 4.9★ venues.

---

## Current menus, voice & decisions (Oct 2026 handoff)

From a handoff doc Stefan wrote in the chat app (Oct 2026). **Its menu section is a PLAN, not the current menu, and its music line is outdated (Stefan, Oct 15).** Co-owner: Juan. Guest-facing email stays **chebararuba@gmail.com** (Stefan's choice, Oct 15) even though the handoff lists info@chebararuba.com.

**Brand voice (critical for website, emails, ads):** honest, warm, unhurried, worth the money. Describe things as they are — "Scrambled eggs, bacon, skillet potatoes, toast, and a side of fresh fruit." Never use "amazing", "indulgent", "nutritious", "superfood", "delicious" or other hype words.

**Planned new Nights menu (NOT live yet):** Margherita $20 · Pepperoni $18 · Hawaiian $19 · Prosciutto & Rucola $24 · Empanada Sampler $12 (chicken, beef, cheese) · The Full Spread for Two $40 (3 empanadas, 1 pizza, 2 local beers) · Pizza & Beer for Two $42 (2 pizzas, 2 local beers) — combos exclude Prosciutto & Rucola, +$4 to upgrade · Nutella Pizza $12.

**Planned drinks changes (NOT live yet):** signature cocktails $15–17 (Espresso Martini, Honey Deuce, Coco Mojito, Pineapple Mule, Aperol Spritz, Fresca Paloma) · Che Bar Classics $12 (Mai Tai, The Hulk, Aruba Ariba, Long Island, Hurricane), **2-for-1 at happy hour 5–7 PM daily** · frozen $14 · local beer $6 (Balashi, Chill, Magic Mango) · Amstel Bright/Heineken $6.50, Miller Lite $7.50, Corona $8 (replaced Coronita), Modelo $11 · Trapiche wine $9. Current happy hour (still in use): local beers $5, wines $6, Che Bar Classics $7, shots $8.

**Current printed menus (Oct 15, = website):** Mornings = website Breakfast tab (plus "Ready for a cocktail? Mimosa, Bloody Mary, Espresso Martini"). Nights = empanadas all day ($4–4.50) + pizzas from 6 PM: Margherita $20, Pepperoni $18, Garden Veggies $18, Hawaiian $19, Americana $20, Happy Island $21, Aruba Loves You $22, Mellow Mushroom $19, Prosciutto & Rucula $24, Nutella Pizza $12.

**Mornings menu:** website matches the handoff (pancakes $14.50–15.75, Big Breakfast $14, etc.). A breakfast research study (`~/breakfast-research/`, Oct 6) recommends a new 18-item menu with new prices — NOT confirmed by Stefan; don't publish those prices until he locks them. Fresh OJ (large sells ~7.8/day) is not on the menu yet.

**Live music:** **Thursdays, Fridays and Sundays** in September and October 2026, and staying that way for now (Stefan, Oct 23; this replaces his Oct 15 "Thursdays + Sundays"). Times vary around 7–9 PM. The schedule before September is unknown: ask before using it for a music-ROI comparison. The handoff says it was cut to Fridays + Saturdays — that is not what is happening; confirm before changing the website.

**Decisions (locked):** Marketing agency RFP going to MRZ Media, Aruwave, Strena, EMP, The Warm People (target ~$2K/mo). Agencies get Meta **Standard access only, never Full Control**. POS: 2 Revel iPads (inside counter + outside bar), each with its own drawer; per-iPad Z-read at close. Cash handover: 3-person witness, tips stay in drawer, 1% of shift cash sales = variance tolerance, cash to the upstairs drop safe.

**Pending (from the handoff):** hotel concierge one-pager; Ops Manual ch. 4 (evening close) + ch. 5 (kitchen opening); order 5,000 QR review cards; photo shoot; Lady B TripAdvisor reply; POS cleanup (dead items, typed one-offs, Hot Chocolate 0 sales, "2 eggs" as modifier only).

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
- **Anthropic API** for the AI features (review responder, report chat and analysis, emailed Revel PDFs, marketing). The model is set once in `lib/ai.ts`; when Anthropic retires it, change it there.

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
- `/dashboard/tasks` — full task browser (7 categories; Stefan cleared the seeded tasks on Oct 11 2026, see below)
- `/dashboard/metrics` — placeholder page only
- `/dashboard/review-responder` — AI-powered review response generator (Anthropic API)

**Database (Supabase):**
- `categories`, `subcategories`, `tasks`, `task_activity` — populated from `supabase/master_plan.md`. On Oct 11 2026 Stefan cleared all tasks on purpose; the 259 old tasks and their history are kept in `backups.tasks_2026_10_11` and `backups.task_activity_2026_10_11`.
- `daily_metrics` — empty, awaiting entry UI
- `reviews_snapshot` — empty (Google Places API integration was built but parked)
- `reviews_individual` — schema not yet added (was part of the parked reviews tracking)

**Access control (per person since Oct 23 2026; auth re-enabled Oct 11 2026):**
- `middleware.ts` → `lib/supabase/middleware.ts` gates `/dashboard/*` (redirect to /login, or to the person's first allowed page) and `/api/*` (401/403). Exceptions: `/api/ingest-email` (own shared secret), `/api/public/*` (guest booking and careers APIs) and `/rota/[token]` (public staff schedule, by design).
- **What each login may open lives in `lib/permissions.ts`** (pure; used by the middleware, server code and the Team screen). Permissions: today, checklists (+ `checklists.edit`), purchasing, deliveries, schedule (+ `schedule.edit`), team, reservations (+ `reservations.settings`), menu (+ `menu.edit`), handbook (+ `handbook.edit`), applicants, tasks, sales, marketing. An edit permission includes its view; purchasing includes deliveries. `PAGES` and `APIS` map every dashboard page and API route to what they need (APIs: one list for reads, one for writes). **A page or API missing from those lists is only for people who have everything, so add new ones there.**
- **Owners only:** `/dashboard/one-pager` and `/api/one-pager` (`ownerOnly` in `lib/permissions.ts`, checked by the middleware and again in the page and route). This is the business summary for prospective buyers (Oct 2026), and a manager with everything still can't open it. The HTML is built outside this repo (`~/chebar-sale/build_summary.py`) and uploaded into `owner_documents` (slug `one-pager`) by `~/chebar-sale/publish_one_pager.py`, so the numbers never land in git. The route serves it with a CSP `sandbox` header: its own script runs, but it can't reach the dashboard's session. Migration `supabase/owner-documents.sql` (RLS on, no policies: service role only).
- **Private buyer links (Oct 2026):** owners make one per person under the One Pager ("Buyer links", `components/share-links.tsx`, `/api/one-pager/links` + `/[id]`).
  - **The link:** `/view/<token>` is public on purpose. `app/view/[token]/route.ts` asks for the passcode, then serves the One Pager with that person's name as a watermark over every screen and a "prepared for" ribbon. Sections the link hides (default: The offer) are cut out of the page between the `<!--section:key-->` markers that `build_summary.py` puts around every section (a CSS rule hides any without markers), the checkbox bar is removed (the `<!--controls-->` markers), print is blocked, and the same CSP sandbox applies (`SANDBOXED_HEADERS`). What a link shows can be changed afterwards ("What they see" on its card).
  - **Documents (Oct 28 2026), view only:** the One Pager's Documents section lists documents (tax returns, bank statements, payslips, company and permits) that buyers can look at but not download or print (Stefan's call). `~/chebar-sale/prepare_docs.py` fills `~/chebar-sale/docs/` (payslips with names, addresses, phones and bank accounts blacked out by rendering the pages to images; the bank's statements saved without their edit lock) and renders every document to page images, `docs/view/<name>.json` (WebP data URLs, at most 4.2 MB each so a viewer response stays under Netlify's 6 MB). `publish_one_pager.py` uploads only those JSON files to the private bucket `one-pager-docs` (migration `supabase/one-pager-docs.sql`), keeping the bucket equal to that folder: the PDFs never leave Stefan's computer. A file's name decides its group and label (`docFile` in `lib/share-sections.ts`: `tax-return-`, `bank-statement-`, `payslips-`, and for "Company and permits" `kvk-extract-`, `permit-business-`, `permit-female-staff-`, `permit-fee-`, `gas-certificate-`, each + a date), and each group is a "What they see" choice. Buyers open `/view/<token>/docs/<name>` (their cookie, an active link, a group the link shows): `docViewerHtml` in `lib/share-links.ts` inlines the page images (the sandbox loads nothing else) under their name and ribbon, and blocks right-click, dragging, long-press saving and printing; screenshots can't be stopped, the name makes them traceable. Each look is logged in `share_link_views` with `file` set (openings are the rows without a file and only those count against max openings). Owners get the same viewer without a name at `/api/one-pager/docs/<name>`, opened in a new tab: a click that loads something inside the sandboxed One Pager (its iframe on the tab) arrives without the owner's login cookies (Chrome counts it as cross-site; Stefan got "Not authenticated"), while a new top-level tab carries them. Buyer pages are top-level, so their `cb_view` cookie comes along.
  - **Passcodes:** shown once to the owner and stored only as a scrypt hash. 10 wrong tries lock the link; the owner can unlock it.
  - **Cookies:** a correct passcode sets a 12-hour cookie for that path, signed with the link's own secret.
  - **Logging:** every opening goes into `share_link_views` with a short network fingerprint (not the address) and the user agent.
  - **Ending a link:** it expires on a chosen day, can be switched off or on, and has optional max openings. Logic in `lib/share-links.ts` (server) and `lib/share-sections.ts` (shared).
  - Migration `supabase/share-links.sql` (RLS on, service role only).
- Each team member has a role (owner / manager / employee) and an optional list in `team_members.access`. No list means the role's default: managers get everything, employees get `STAFF_DEFAULT` (checklists, deliveries, schedule, reservations, menu, handbook: what staff had before). Owners and `ALLOWED_EMAILS` (Netlify prod: Stefan) always have everything. Only owners change roles and access: Team tab → person → Can open, with quick picks (Staff / Staff + Purchasing / Everything) or Off / View / Edit per part. Others with Team access only add, edit and set passwords for staff who can't open more than they can (`canManageMember`), so nobody gets more access through someone else's login. The list shows how someone differs from their role's default ("+ Purchasing", "no Sales, Marketing").
- Server code: `getSessionInfo()` → `{ email, perms, owner, memberId, memberName }`. API routes use `sessionWith(perm)` (403 with `NO_ACCESS`). Screens that take a manager/employee `role` prop get `screenRole(session, editPerm)`, e.g. the menu screen shows its edit tools to whoever has `menu.edit`. The nav (`components/nav-sidebar.tsx`) lists the person's parts. On phones the bar has 5 slots: with more items, the first 4 from `PHONE_FIRST` get a tab and the rest go under More (staff and managers keep the tabs they had). The Today page only shows the cards a person has access to.
- Database (`supabase/access.sql`, applied Oct 23 2026): `team_members.access`, `current_member()` (security definer; the middleware reads the login's team row through it) and `dashboard_can(perm)` (mirrors the TS rules: keep its staff list the same as `STAFF_DEFAULT`). The old "any signed-in user may read and write" RLS policies are gone. Server code uses the service role. The browser itself only touches `tasks` (Tasks page, policy `dashboard_can('tasks')`) and `daily_metrics` (Metrics and Music pages, `dashboard_can('sales')`); every other table is service-role only. An `ALLOWED_EMAILS` login without an owner row in team_members couldn't save on those two pages (Stefan has one).
- Staff log in with passwords set on the Team tab (`/api/team/login`, Supabase admin API) because Supabase's built-in email only reaches project members. No email goes out: tell people their password yourself. Anyone signed in can change their own password (key icon in the phone header, "Change password" in the sidebar: `components/change-password.tsx`, `supabase.auth.updateUser` with their own session). An owner who forgot theirs signs in with "Owner: email me a sign-in link instead" on the login page (it works for Stefan because Supabase's built-in email reaches project members), then changes it there. `ALLOWED_EMAILS` logins can't be reset from the Team tab, on purpose. Magic-link sign-in still creates accounts for any email; those see nothing without a team row, but disabling signups in Supabase would be tidier.

**Purchasing workflow (Oct 2026):** managers build orders on Purchasing (counts persist in localStorage) → Orders, grouped by supplier, with a Copy order button (owner pastes it into email/WhatsApp himself) → Mark sent → anyone checks the delivery in (received vs ordered, short quantities) → missing items land in "Not delivered" (reorder or dismiss) and push an ntfy alert to the owner (`NTFY_TOPIC` env, production only). Delivery records live in `purchase_orders.deliveries` (jsonb) — migration `supabase/purchasing-workflow.sql`. Shared logic: `lib/purchasing.ts`. **Purchase orders (Oct 2026):** each supplier part of an order can be turned into an official PO PDF (Orders → "Purchase order"). The first time, it gets a number from the `assign_po_number` RPC (sequence from PO-1001, stored in `purchase_orders.po_numbers` as `{supplier_id: {number, issued_at}}`; migration `supabase/purchase-order-numbers.sql`). The same number and date are reused after that. `POST /api/orders/po` (managers only) returns the PDF, built by hand in `lib/po-pdf.ts` (A4, standard Helvetica, no PDF library). Che Bar's address and contact details on the PO come from `BUYER` in `lib/purchasing.ts`. The phone sheet offers Send (Web Share with the file: WhatsApp, email), Download and Open to print.

**Reservations (Oct 2026):** guests book at chebararuba.com/reserve/ (static page in the site repo; Happy Hour 5–7 PM times highlighted) → public API `/api/public/reservations` (+ `/manage` for the guest's change/cancel link; CORS limited to chebararuba.com; middleware lets `/api/public/` through) → `book_reservation` RPC, which enforces "max guests arriving per half hour" under a per-day advisory lock. Staff (managers + employees) see and manage bookings on `/dashboard/reservations`; online-booking settings and closing a day are manager-only. Shared rules in `lib/reservations.ts` (Aruba time, 30-min slots). New/cancelled online bookings push an ntfy alert. Guests are contacted by email only (email required, no phone/WhatsApp on the booking page): confirmation, staff changes and cancellations go out through Resend (`lib/email.ts`, `lib/reservation-emails.ts`) once `RESEND_API_KEY` is set in Netlify and chebararuba.com is verified in Resend (DNS is on Netlify; root MX is Microsoft 365, so Resend uses the send. subdomain). From `reservations@chebararuba.com` (no mailbox needed), replies to `RESERVATIONS_REPLY_TO` (default chebararuba@gmail.com). Without the key everything works, just without emails. **Live since Oct 15 2026:** domain verified in Resend (Netlify DNS: TXT resend._domainkey, CNAME send + rsend -> *.forge.rmta.net); test booking emailed fine. RESEND_API_KEY is a *secret* Netlify env var: the CLI/API only return a 20-char stand-in, so test it through the app (GET /api/public/reservations shows emails:true), not by reading it. Migration `supabase/reservations.sql` (RLS on, no policies: service role only). The dashboard is installable as a home-screen app (`app/manifest.ts`, PNG icons in `public/`), meant for the POS iPad; the reservations screen refreshes itself every minute.

**Daily checklists (Oct 2026):** `/dashboard/checklists` for managers and employees (employees: read + tick; managers: edit lists, look back at past days). Business day rolls over at 5 AM Aruba time (`lib/checklists.ts` businessDate), so after-midnight closing ticks count for the night before; only today can be ticked. Lists have a team (all/foh/kitchen), weekdays and an optional done-by time (late flag). Removing a list or item sets active=false so history stays readable. One check per item per day (`checklist_checks`, unique item_id+date) records who and when. Today page shows a Checklists card. Migration `supabase/checklists.sql` seeds 5 starter lists on first run. Phone tab bar: see Access control (`PHONE_FIRST` in `components/nav-sidebar.tsx`).

**Menu & Recipes (Oct 2026):** `/dashboard/menu` — every dish and drink with photo, price, guest description, ingredients (jsonb `[{name, qty, unit, item_id?}]`), steps, notes and allergens. All staff read; managers add/edit (`/api/menu`); removing sets active=false. Photos go to the public Supabase Storage bucket `menu-photos` via `/api/menu/photo` (shrunk to 1600px JPEG in the browser, 5 MB max). Migration `supabase/menu.sql` creates the table + bucket and, only when the table is empty, seeds the current printed menus (Oct 15 2026: 75 items — Mornings, empanadas all day, 9 pizzas + Nutella, drinks); amounts and steps are left for the chef. Seed photos link to chebararuba.com/images/food. What each pizza photo shows: pizza-01 = Prosciutto & Rucula, pizza-03/04/05 = Pepperoni, pizza-10 = Aruba Loves You, pizza-21 = Happy Island, pizza-17 = a plain ham pizza (not used); the website's alt texts were corrected on Oct 20 2026. The optional `item_id` on ingredients is for linking to purchasing items later (food cost per dish from invoices — next step, not built).

**Handbook (Oct 2026):** `/dashboard/handbook` — chapters and sections (`handbook_chapters`, `handbook_sections`); all staff read, managers write, rename, reorder and delete (`/api/handbook`). Section text is plain text with a small markup (`## heading`, `- bullets`, `1. steps`, `**bold**`) parsed by `parseBlocks` in `lib/handbook.ts` and never rendered as HTML. Deep link: `?s=<section id>`. Migration `supabase/handbook.sql` seeds a proposed 9-chapter / 43-section table of contents (empty sections with a one-line hint) for Stefan to review.

**Careers & notifications (Oct 2026):** job seekers apply at chebararuba.com/careers/ (static page in the site repo, noindex: shared only through Facebook ads; the FB pixel fires `SubmitApplication`). The form posts multipart to the public API `/api/public/applications`: honeypot field `website`, max 3 per hour per visitor, CV optional (PDF, Word or photo, max 4 MB so the request stays under Netlify's 6 MB function limit; big phone photos are shrunk in the browser first). CVs go to the private Storage bucket `applications` (`<application id>/<file name>`) and open through a 5-minute signed link (`/api/applications/cv?id=`). Each application creates a `job_applications` row, a `notifications` row, an ntfy push, an email to RESTAURANT_EMAIL and a thank-you email to the applicant (both from jobs@chebararuba.com via Resend). Managers work the list on `/dashboard/applicants` (`?id=` opens one): status New / Contacted / Interview / Keep for later / Hired / Not a fit, private notes, WhatsApp / Call / Email / CV buttons; delete also removes the CV. The nav badge counts status 'new'. The bell (people with Applicants access, `components/notification-bell.tsx`, in the sidebar and the phone header) reads `/api/notifications` every minute while on screen: new applications, new and cancelled online bookings, deliveries with missing items. Each person only gets the kinds for parts they can open (bookings need Reservations, deliveries need Purchasing). Add more with `addNotification` in `lib/notifications.ts` (best-effort, never blocks the action). Migration `supabase/applications.sql` (RLS on, no policies: service role only). Shared rules in `lib/applications.ts`.

**Sales tab (Oct 2026):** `/dashboard/sales` (managers; phone: More sheet) shows Today / Yesterday / Last 7 days / This week (weeks start Monday) / Last week / This month / Last month / This year, each against the matching earlier stretch (`periodRange` in `lib/sales.ts`), with orders, guests, a daily chart (monthly for the year), missing-day warnings and the products sold (`product_sales_summary` RPC, `GET /api/sales?period=`). Until today's report arrives, today is left out of the totals and of the comparison. **Where the numbers come from:** Revel emails its daily reports to revel@ingest.chebararuba.com. Any address @ingest.chebararuba.com works: MX → SendGrid Inbound Parse → `/api/ingest-email?secret=INGEST_EMAIL_SECRET`. `lib/inbound-email.ts` reads both ways SendGrid posts (parsed `attachmentN` fields, or the raw MIME in `email`, via postal-mime). `lib/revel-reports.ts` reads Revel's CSV exports exactly. The **Sales Summary** export has one row per business day (6 AM to 6 AM): Net Sales → `daily_metrics.revenue_total`, Total Orders → `orders_total`, Total Number Of People → `covers_total`. The **Product Mix (Daily)** export has day labels above Quantity/Total column pairs; a one-day export takes its date from the file name. It goes to `product_sales` through the `replace_product_sales` RPC, which replaces one day as a whole. Per day, the product totals equal the summary's Total Product Sales (before discounts); Net Sales is after discounts. PDFs fall back to Claude extraction. Each original attachment is kept in the private bucket `revel-reports` (`report_ingestions.file_path`), and every email is logged in `report_ingestions` (shown on the Reports page, which is not in the nav). Jan 1 – Oct 21 2026 was back-filled from Revel exports: 294 days, $584,657.83 net, 16,719 orders, 20,306 product rows. To fill a missed day, forward any Revel CSV export to the same address. Revel's reports have no time-of-day split, so the daypart card only shows when daypart data covers 90% of the period. Migration `supabase/sales.sql`.

**Marketing tab (Oct 2026):** `/dashboard/marketing` (managers; phone: More sheet) is only Facebook + Instagram (`components/meta-overview.tsx`). It has a period switch (Last 7 days or Last 4 weeks), and each platform card shows followers, new followers, views, reach per day, profile visits and interactions, with the change against the previous period. The change compares per-day averages. Below that: a day-by-day line chart (both platforms, a choice of five metrics), "Who follows you on Instagram" (countries, cities, age, gender from follower_demographics in `social_audience`), and every recent post with views, reach, likes, comments, shares, saves and % engaged, sortable and filterable. The old AI sub-tabs (Ideas, Create content, Reviews) and the manual post and campaign logs were removed on Stefan's request (Oct 23). The review-reply writer still lives on `/dashboard/reviews`, which is not in the nav. **Data:** `lib/meta.ts` `syncMeta` reads Meta's Graph API (v25.0) with `META_ACCESS_TOKEN`, a never-expiring key of the system user "Chebardashboard" in the **Sonensein** business portfolio. That portfolio owns the Che Bar Aruba page (ID 447553231978919) and @chebararuba; the system user has Community activity + Insights on both, plus the app "Che Bar Dashboard" (App ID 1055376407463897, Business type, Development mode). Scopes: pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, ads_read. It writes `social_daily` (date × platform: followers snapshot, new_followers, reach, views, profile_views, engagements) and upserts posts into `social_posts` (`external_id` fb_/ig_; never overwrites a stored number with a missing one). Every run is logged in `meta_sync_log` with a `checks` map of what Meta returned or refused: **read it first when numbers are missing**, because Meta dropped and renamed many insight metrics in 2025–2026 (IG impressions → views; FB page reach metrics gone in June 2026). It keeps 56 days of daily numbers (Instagram is one call per day, backfilled newest first within the time budget), and the last 20 posts per platform with their insights. It runs when the tab opens with data older than 3 h (`POST /api/marketing/meta`, 8 s budget) and daily at 7 AM Aruba (`netlify/functions/meta-sync-daily.mts`, Netlify scheduled function, 25 s budget). **Facebook posts** need the extra permission `pages_read_user_content` on the key (Meta error #10 on published_posts and posts); until Stefan regenerates the key with it, only Instagram posts show. Ads: Instagram-app boosts are paid from an ad account outside Sonensein. It has to be added to the portfolio and assigned to the system user before ad spend can be read. Migration `supabase/meta.sql`.

**Built but PARKED (files in repo but feature not deployed):**
- Google Reviews tracking — daily scheduled function + dashboard page. Parked because Stefan didn't want to set up the Google Cloud Console / Places API key. Can revive whenever — the SQL migration is in `supabase/reviews_migration.sql`.

---

## Open items / next steps

In rough priority order:

1. ~~**Verify review responder works end-to-end.**~~ Done Oct 22 2026: after the move to Claude Sonnet 5.5 (`lib/ai.ts`), Stefan generated a reply on `/dashboard/reviews` (also the Reviews tab in Marketing).
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
- Since Oct 21 2026 the Supabase connector is connected in Claude: apply the migration file with `apply_migration` on project `ppxjjgzlvztwkzfaaebm` and check it with `execute_sql`. Don't send Stefan SQL to paste. Deleting data still needs his OK.
- Test the SQL on a fresh Supabase project before applying to production

For deploys:

- Push to `main` triggers Netlify auto-deploy
- Netlify env vars are managed in Site configuration (not in git)
- The deploy fails fast if TypeScript breaks — check the build log first when something's off
