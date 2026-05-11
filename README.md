# Che Bar Dashboard

Internal operations dashboard for Che Bar Aruba. Built with Next.js 14, Supabase, Tailwind, and deployed to Netlify.

## What's included

- ✅ Email + password and magic-link auth (Supabase Auth)
- ✅ Task list with categories, subcategories, status toggle (~250 tasks pre-loaded from the master plan)
- ✅ Dashboard home with task counts and recent completions
- ✅ Mobile-responsive
- 🚧 Metrics page (placeholder — extend with Claude Code)

## Setup (one-time, ~20 minutes)

### 1. Supabase

In your Supabase project:

1. Open **SQL Editor** → **New query**
2. Paste the contents of `supabase/schema.sql` and run it
3. Go to **Settings → API**, copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY` (only used for seeding)
4. Go to **Authentication → Providers** and confirm Email is enabled
5. Go to **Authentication → Users** and click **Add user** to create accounts for yourself and your manager. Use real emails.

### 2. Local setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Then edit .env.local with the values from Supabase

# Seed the database (loads ~250 tasks from supabase/master_plan.md)
npm run seed

# Run locally
npm run dev
```

Open http://localhost:3000 and sign in with the email/password you created in Supabase.

### 3. Deploy to Netlify

```bash
# Initialize git if you haven't
git init
git add .
git commit -m "Initial dashboard"

# Push to GitHub (create a new private repo first)
git remote add origin https://github.com/YOU/che-bar-dashboard.git
git push -u origin main
```

In Netlify:

1. **Sites → Add new site → Import an existing project**
2. Connect to your GitHub repo
3. Build settings should auto-detect (Next.js Runtime plugin)
4. **Site configuration → Environment variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (only needed if you'll re-seed from Netlify)
5. **Trigger deploy**
6. Configure custom domain (e.g. `dashboard.chebararuba.com`) in Domain Management

### 4. Tell Supabase about your Netlify URL

Back in Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://dashboard.chebararuba.com` (or your Netlify URL)
- **Redirect URLs**: add `https://dashboard.chebararuba.com/auth/callback`

This is required for magic-link emails to work.

## Re-seeding the database

If you edit `supabase/master_plan.md` (add tasks, restructure), re-run:

```bash
npm run seed
```

⚠️ This wipes and recreates all categories/subcategories/tasks. Completed task history is lost. Add new tasks via the UI to preserve their state.

## Project structure

```
che-bar-dashboard/
├── app/
│   ├── login/            # Sign-in page
│   ├── dashboard/        # Protected pages
│   │   ├── page.tsx      # Home overview
│   │   ├── tasks/        # Task browser
│   │   └── metrics/      # Metrics (placeholder)
│   └── auth/callback/    # Magic-link callback
├── components/
│   ├── nav-sidebar.tsx
│   └── task-browser.tsx
├── lib/supabase/         # Auth clients (browser + server)
├── supabase/
│   ├── schema.sql        # Run this first
│   └── master_plan.md    # Source of truth for seed
├── scripts/
│   └── seed.ts           # Parses master_plan.md into DB
├── middleware.ts         # Protects /dashboard routes
└── netlify.toml          # Netlify build config
```

## Extending with Claude Code

This is the MVP. To add features (metrics page, daily entry, etc.), run Claude Code in this directory:

```bash
claude
```

Useful prompts:

- *"Build the metrics page. Show revenue by day for the last 30 days, with breakfast/lunch/dinner breakdown. Add a form at the top to enter today's numbers into `daily_metrics`. Use Recharts."*
- *"Add a 'quick add' button to the task list that opens a modal to create a new task in the current category."*
- *"Build a music ROI tracker page that queries `daily_metrics` and shows average revenue on music nights vs non-music nights, by day of week."*
- *"Add Google rating tracking — a form to enter today's snapshot, and a chart showing the trend over time."*

Claude Code reads this README, the schema, and the existing code, so it can extend the dashboard coherently.

## Adding users

In Supabase **Authentication → Users → Add user**. They'll receive an email to confirm, then can log in.

If you want to restrict who can sign up (vs invite-only), you've already got that by default — Supabase only allows users you explicitly create.

## Troubleshooting

**Magic link emails not arriving:** Check Supabase **Authentication → Email Templates** is configured. The free tier uses Supabase's email which sometimes hits spam.

**Tasks not loading after seed:** Verify the schema ran successfully. Check the `categories` table in Supabase Table Editor — should have ~7 rows.

**"Failed to fetch" errors in browser:** Most likely env vars not set. Check Netlify Site Configuration.
