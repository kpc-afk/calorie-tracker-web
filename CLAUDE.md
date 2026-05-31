# Calorie Tracker Web

Personal AI-powered calorie tracker. Web app accessible on iPhone via browser — no packager, no Xcode needed.

## What It Does

- Unified Gemini chat interface: log food (text or photos), log workouts (description or Apple Health screenshots), set steps — all in one chat window
- Dynamic daily calorie budget: BMR ± AI-recommended deficit + actual steps + actual workout calories (no activity level estimates)
- Calorie ring, macro bar, food log on the Dashboard tab
- Progress charts (calorie trend, macro averages, weight) + table view + CSV export
- Magic link email auth — no password, works great on iPhone
- PWA: add to iPhone home screen from Safari → works like a standalone app
- Data stored in Supabase (PostgreSQL) — accessible from any device

## What Was Intentionally Removed vs. The Native App

| Removed | Why / Replacement |
|---|---|
| Live camera viewfinder | Browser file picker (multi-image) replaces it |
| Apple Health API | Upload workout screenshots → AI reads active kcal |
| Activity level dropdown | Actual daily steps + workout logging replaces estimates |
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
```

All three are required. `GEMINI_API_KEY` is server-side only (not `NEXT_PUBLIC_`).

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
| AI | Gemini 1.5 Flash (server-side API routes) |
| Charts | Recharts |
| PWA | `public/manifest.json` + apple-web-app meta tags |

## Folder Structure

```
app/
  (auth)/login/          Magic link login
  auth/callback/         Supabase OAuth callback
  onboarding/            First-time setup + AI deficit recommendation
  (app)/
    layout.tsx           4-tab shell (Chat, Log, Progress, Settings)
    chat/                Primary tab — unified AI chat
    dashboard/           Log tab — ring, macros, food log, activity
    progress/            Charts + table + CSV export
    settings/            Profile + sign out
  api/
    chat/                Unified AI dispatcher (all intents)
    tdee/                BMR calculation + onboarding chat
    profile/             Get/save user profile
    entries/             Food entry CRUD + all-entries for export
    activity/            Daily steps + workout logging
    progress/            Analytics data
    weight/              Weight entry logging

components/             UI components (CalorieRing, MacroBar, FoodCard, etc.)
lib/
  supabase/             Browser + server Supabase clients + middleware
  ai/                   Gemini client, chat dispatcher, TDEE logic
  db/                   TypeScript types + Supabase query helpers
  utils/                BMR formula, steps kcal, CSV, date formatting

supabase/migrations/    001_initial.sql — 4 tables + RLS policies
```

## How the Calorie Budget Works

```
daily budget = BMR − deficit_amount + steps_calories + workout_calories
```

- **BMR**: Mifflin-St Jeor using date of birth (auto-updates each year)
- **deficit_amount**: AI-recommended at onboarding (update via Settings → Edit profile)
- **steps_calories**: steps × 0.000571 × weight_kg (~400 kcal per 10k steps at 70 kg)
- **workout_calories**: AI reads Apple Health screenshots or estimates from text description

## Key Design Decisions

- **Single `/api/chat` endpoint** handles all user input — Gemini detects intent (`food_log` / `workout` / `steps` / `question`) and returns a typed `ChatResponse` discriminated union
- **No activity level multiplier** — replaced by actual daily step + workout logging
- **Food items include AI commentary** — 1–2 sentence explanation of the estimate for fact-checking
- **Per-item editing** — every food card returned in chat is editable inline before confirming
