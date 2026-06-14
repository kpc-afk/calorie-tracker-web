# Calorie Tracker Web

Personal AI-powered calorie tracker. Web app accessible on iPhone via browser — no packager, no Xcode needed.

**Design language ("Editorial Instrument"):** warm near-black background, bone-ivory ink, acid chartreuse accent, Instrument Serif display type, hairline borders, tabular numerals — restrained editorial look, no chat-bubble/glassmorphism/generic-AI aesthetics. Tokens in `app/globals.css`; primitives in `components/ui/`.

## What It Does

- Unified Gemini chat interface: log food (text or photos), log workouts (description or Apple Health screenshots), set steps — all in one chat window
- Dynamic daily calorie budget: BMR ± AI-recommended deficit + steps/workout earn-back, with a baseline steps allowance (see "How the Calorie Budget Works")
- Calorie ring, macro bar, food log on the Dashboard tab
- Progress tab: real-TDEE/trend-weight/goal-ETA headline stats, weight trend chart, compliance strip, calorie/macro charts, eating-pattern insights, table view + CSV export
- Coach tab: daily digest, streaming AI chat for questions, adaptive target suggestions, weekly review
- Apple Health sync via iOS Shortcut (steps, active energy, weight) — see `docs/health-sync-shortcut.md`
- Magic link email auth — no password, works great on iPhone
- PWA: add to iPhone home screen from Safari → works like a standalone app
- Data stored in Supabase (PostgreSQL) — accessible from any device

## What Was Intentionally Removed vs. The Native App

| Removed | Why / Replacement |
|---|---|
| Live camera viewfinder | Browser file picker (multi-image) replaces it |
| Apple Health API (live, in-app) | Daily Shortcut sync (steps/energy/weight) + workout screenshots for per-workout detail |
| Activity level dropdown | Baseline steps + earn-back rate (Settings → Budget model) replace estimates |
| SQLite (device-local) | Supabase PostgreSQL (cloud, always accessible) |
| Expo / React Native | Next.js web app |

## How to Run Locally

```bash
cd "/Users/kyle-LBS/Documents/Claude Code Projects/Calorie Tracker Web"
npm install
npm run dev
```

Open `http://localhost:3000` — redirects to login.

## Environment Variables

`.env.local` (never committed):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
HEALTH_SYNC_SECRET=your_generated_secret
```

`SUPABASE_SERVICE_ROLE_KEY` and `HEALTH_SYNC_SECRET` are only needed for `/api/health-sync` (Apple Health → Shortcuts sync). Both are server-side only.

The first five vars above are required. `GEMINI_API_KEY` is server-side only (not `NEXT_PUBLIC_`). Optionally set `GEMINI_FALLBACK_MODEL` (server-side) to override the default fallback model (`gemini-3.1-flash-lite`) used when the primary model errors.

## Deploying

1. Push to GitHub
2. Import repo at vercel.com → add the 3 env vars → Deploy
3. In Supabase → Authentication → URL Configuration: add `https://your-url.vercel.app` as Site URL and `https://your-url.vercel.app/auth/callback` as redirect URL

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database + Auth | Supabase (PostgreSQL + magic link) |
| Hosting | Vercel |
| Styling | Tailwind CSS v4 (dark theme) |
| AI | Gemini 3.5 Flash, with `gemini-3.1-flash-lite` fallback (server-side API routes) |
| Charts | Recharts |
| PWA | `public/manifest.json` + apple-web-app meta tags |

## Folder Structure

```
app/
  (auth)/login/          Magic link login
  auth/callback/         Supabase OAuth callback
  (app)/
    layout.tsx           5-tab shell (Chat, Log, Progress, Coach, Settings)
    chat/                Primary tab — unified AI chat
    dashboard/           Log tab — ring, macros, food log, activity
    progress/            Headline stats, trend chart, compliance, patterns, table + CSV export
    coach/               Daily digest, streaming AI chat, adaptive target, weekly review
    settings/            Profile, macro targets, budget model, data, app info
  api/
    chat/                Unified AI dispatcher (all intents)
    profile/             Get/save user profile
    entries/             Food entry CRUD + all-entries for export
    activity/            Daily steps + workout logging
    progress/            Chart data (calorie/macro/weight history)
    analytics/           Trend TDEE, weight trend, ETA, compliance, patterns
    week/                Current-week summary
    adaptive-target/     Adaptive deficit/target suggestion
    weekly-review/       AI-generated weekly review
    weight/              Weight entry logging
    health-sync/         Apple Health Shortcut sync (steps/energy/weight)

components/             UI components (CalorieRing, MacroBar, FoodCard, ui/ primitives, etc.)
lib/
  supabase/             Browser + server (+ admin/service-role) Supabase clients + middleware
  ai/                   Gemini client (primary + fallback model), chat dispatcher, TDEE logic
  db/                   TypeScript types + Supabase query helpers
  utils/                BMR/budget formulas, dates (Europe/London), CSV, cache, haptics

supabase/migrations/    001_initial.sql + incremental migrations — 7 tables + RLS policies
```

## How the Calorie Budget Works

```
base target    = effective TDEE − deficit_amount
steps bonus    = max(0, steps − baseline_steps) × 0.000571 × weight_kg × earn_back_rate
workout bonus  = workout_calories × earn_back_rate

daily budget = base target + steps bonus + workout bonus
```

- **effective TDEE**: `profile.tdee` if set (from onboarding), else `BMR × 1.2`
- **BMR**: Mifflin-St Jeor using date of birth (auto-updates each year)
- **deficit_amount**: AI-recommended at onboarding (update via Settings → Edit profile, or accept a Coach adaptive-target suggestion, which adjusts `target_calories`/`deficit_amount` directly)
- **baseline_steps** / **earn_back_rate**: tunable in Settings → Budget model. Steps up to the baseline are already assumed in TDEE; only steps above it (and workout calories) earn back a fraction of the budget
- **workout_calories**: AI reads Apple Health screenshots, estimates from text description, or comes from the daily Health sync (active energy minus steps-derived calories)

The Progress tab's "Real TDEE" stat is a separate weight-trend-derived estimate (`/api/analytics`) used to power the Coach's adaptive target suggestion — it doesn't directly change `effective TDEE` above.

## Key Design Decisions

- **Single `/api/chat` endpoint** handles all user input — Gemini detects intent (`food_log` / `workout` / `steps` / `question`) and returns a typed `ChatResponse` discriminated union
- **No activity level multiplier** — replaced by baseline steps + earn-back rate against actual daily step/workout logging
- **Food items include AI commentary** — 1–2 sentence explanation of the estimate for fact-checking
- **Per-item editing** — every food card returned in chat is editable inline before confirming
- **All AI calls are user-initiated or DB-cached** — no background/scheduled Gemini calls, to stay within the free tier (Coach digest and weekly review are cached via `insights`, regenerated on demand)
- **`/api/coach`'s old proactive nudge endpoint (`coaching-nudge`) was removed** — superseded by the Coach tab's on-demand digest/chat/weekly review
