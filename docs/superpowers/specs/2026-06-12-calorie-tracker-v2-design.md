# Calorie Tracker v2 — "Editorial Instrument"

Full visual redesign + reliability, analytics, and budget-intelligence upgrade. Single-user
personal app (Kyle). Approved scope, 2026-06-12.

## Goals

1. **Distinctive visual identity** — replace the generic dark-iOS look with a high-fashion
   editorial design language.
2. **Kill "something went wrong"** — Gemini free-tier 429/503s must degrade gracefully
   (retry, fallback, retry button), and chat must feel fast (streaming / staged feedback).
3. **Trend-based intelligence** — weight trend smoothing, TDEE back-calculation, goal ETA,
   weekly compliance, food pattern insights, adaptive target suggestions, calorie banking.
4. **Automatic activity data** — Apple Health flows in via an iOS Shortcut hitting a
   token-secured endpoint. No more workout screenshots.

## Hard constraints

- **Gemini free tier**: no automatic/background AI calls, ever. Every Gemini call is
  user-initiated or once-per-period cached in DB. Server pre-computes numeric digests and
  sends compact summaries to Gemini, never raw entry dumps.
- **Vercel Hobby**: chat API stays on Edge runtime, total response < 25s (keep the existing
  1024 thinking-budget cap).
- **Supabase free tier**: fine. New migrations allowed (additive only — existing 6 tables
  untouched: user_profiles, food_entries, weight_entries, daily_activity, saved_foods,
  meal_templates).
- **No onboarding flow** (removed deliberately — do not re-add). Profile updates happen via
  chat or Settings.
- Current model: `gemini-3.5-flash`. Implementer must verify available free-tier model IDs
  for the fallback chain at build time.

## Out of scope (explicitly rejected)

Push notifications, Siri quick-log, restaurant menu scan, daily AI brief, progress photos,
body measurements, light theme, nav restructuring (5 tabs stay: Chat, Log, Progress, Coach,
Settings).

---

## 1. Visual identity — "Editorial Instrument"

High-fashion editorial: Vogue meets a Swiss instrument panel. Implemented as design tokens
in `globals.css` + a small set of primitives; every screen rebuilt with them (use the
frontend-design skill for these batches).

**Palette**
- Background: warm near-black `#0A0A09`
- Text: bone/ivory `#F2EFE6` (never pure white)
- Muted text: warm stone gray (~`#8A8678`)
- Hairlines/borders: `rgba(242,239,230,0.12)`
- Accent (one only): acid chartreuse `#C8FF1C` — progress, active states, key stats.
  Preserves "green = good" semantics.
- Over-budget/destructive: muted vermilion (~`#E0452B`) — red still means "over".

**Typography**
- Display: **Instrument Serif** via `next/font/google` — big numerals (48–72px) and page
  headers. Serif numbers on black is the signature move.
- Body/UI: system sans stack (unchanged) for iOS feel.
- Micro-labels: uppercase, letter-spaced (~0.08em), 10–11px, muted ("KCAL REMAINING",
  "PROTEIN").
- Numerals use `font-variant-numeric: tabular-nums` where they animate.

**Surfaces & layout**
- Mostly flat black; sections separated by 1px hairline rules rather than boxed cards where
  possible. Where cards are needed: 1px hairline border, transparent/near-black fill,
  4–6px radius (down from 16–24px).
- Generous whitespace; dense data presented with precision, not decoration.

**Motion**
- Keep existing animated-counter hook and ring animation physics; restyle only.
- CalorieRing survives: thin ~3px track in faint bone, chartreuse progress arc, Instrument
  Serif numeral center, vermilion when over.
- Keep haptics and confetti (recolor confetti to chartreuse/bone).

**Protein-first display**: protein countdown ("82g to go") gets equal visual billing with
calories remaining on the dashboard — Kyle has a hard 130g/day floor.

## 2. AI reliability layer

New `lib/ai/client.ts` wrapping every Gemini call (all API routes migrate to it):

- **Retry**: exponential backoff with jitter on 429/503/network errors, 2 retries max
  (mind the 25s Edge ceiling — cap total retry time ~8s before fallback).
- **Model fallback chain**: primary `gemini-3.5-flash` → a lighter/cheaper flash model
  (implementer verifies current free-tier IDs, e.g. flash-lite variant) with the same
  prompt. Fallback only on capacity errors, not on parse errors.
- **Typed failure result** instead of thrown strings, so UIs can render a "Gemini is busy —
  tap to retry" affordance that re-sends the identical payload. No more dead-end
  "something went wrong".
- **Streaming**: Coach tab streams plain-text answers token-by-token
  (`generateContentStream` through an Edge streaming response). Food logging returns
  structured JSON (can't stream), so chat shows staged progress states
  ("Reading photo… / Estimating macros…") plus skeleton food cards while waiting.
- **Call audit**: remove/forbid any AI call not directly user-initiated. Reusable outputs
  (weekly review) are generated once and cached in the `insights` table.

## 3. Data/speed layer

- Lightweight SWR-style hook (`lib/utils/useCachedFetch.ts` or similar, no new heavy
  deps): in-memory + sessionStorage cache keyed by URL, stale-while-revalidate. Applied to
  profile, entries-by-date, activity, weights. Tab switches render instantly from cache.
- **Optimistic updates** with rollback on failure: food confirm/delete, water, steps,
  manual add.
- Cache invalidation: mutations invalidate the affected date keys.

## 4. Analytics suite (pure math — zero AI calls)

All computed server-side in `/api/progress` (or a new `/api/analytics`), rendered in the
redesigned Progress tab:

- **Weight trend**: exponentially-weighted moving average (Happy Scale-style, α ≈ 0.2)
  rendered as the primary line, raw weigh-ins as faint dots.
- **TDEE back-calculation**: rolling 21-day energy balance — avg daily intake +
  (Δ trend weight in kg × 7700 / days) = estimated true TDEE. Shown as "YOUR REAL TDEE ≈
  2,210". Requires ≥10 logged days + ≥2 weigh-ins in window; otherwise show a
  "needs more data" state.
- **Goal ETA**: current trend slope → projected date hitting goal weight (72 kg).
  Clamp/handle flat-or-gaining trends gracefully ("at current rate, no ETA — trend flat").
- **Weekly compliance**: per week — days within budget, protein-floor (130g) hit rate,
  avg deficit.
- **Food pattern insights**: from food_entries — top 10 most-logged foods, foods most
  correlated with over-budget days, weekday vs weekend calorie averages.

## 5. Adaptive targets

Math-only weekly loop (computed on Progress load, no cron):

- Each Monday (or when last suggestion > 7 days old), compare implied weekly loss rate
  (from trend weight) vs target rate (0.5–0.6 kg/wk).
- If off by > 0.15 kg/wk and TDEE estimate is reliable, surface a suggestion card:
  "You're losing 0.3 kg/wk vs 0.6 target — drop budget 150 kcal?" One tap applies it
  (updates `user_profiles.tdee`/`deficit_amount` via existing profile API), one tap
  dismisses (stores dismissal in `insights` so it doesn't nag).
- Guardrails: never suggest base daily target < 1,400 kcal; never deficit > 750 kcal;
  never suggest increases > 250 kcal at once.

## 6. Calorie banking (weekly lens)

Informational weekly view — daily budget model stays the source of truth:

- Week = Mon–Sun. Weekly budget = sum of realized daily budgets so far + projected
  baseline for remaining days.
- Bank = Σ(daily budget − eaten) over elapsed days. Dashboard gets a compact weekly strip
  (or toggle): "WEEK · bank +320 kcal" with a 7-day mini-bar showing each day over/under.
- Banking is display-only: it never alters the daily ring's budget, but shows "remaining
  today incl. bank" as a secondary figure. Floor: never present an effective day allowance
  below 1,200 kcal.

## 7. Smarter coach + weekly review

- **Coach digest**: `/api/coach` builds a server-computed compact digest (last 28 days:
  adherence stats, trend weight + slope, TDEE estimate, macro averages, streak, banking
  state) injected into the system prompt. Streams responses (per §2).
- **Weekly review**: user-initiated button in Coach ("Generate weekly review") — one
  Gemini call producing a structured review (wins, concerns, one focus for next week) from
  the digest; stored in `insights` keyed by ISO week; subsequent visits that week read
  from DB. Replaces the removed localStorage nudge.

## 8. Apple Health auto-sync

- **Endpoint**: `POST /api/health-sync`, secured by `Authorization: Bearer
  ${HEALTH_SYNC_SECRET}` (new env var; constant-time compare; 401 otherwise). Body:
  `{ date?, steps?, active_energy_kcal?, weight_kg? }` (date defaults to today,
  Europe/London). Upserts daily_activity (steps + steps_calories via existing formula,
  workout kcal from active energy) and weight_entries. Idempotent per date.
  Note: this endpoint authenticates by token, not Supabase session — it must use the
  service-role client (new server-side env var `SUPABASE_SERVICE_ROLE_KEY`), or RLS will
  block writes. User id resolution: single-user app — select the sole `user_profiles` row
  and use its `user_id`.
- **Active energy → workout kcal mapping**: active_energy_kcal minus steps_calories
  (floor 0) is recorded as workout_calories, so steps aren't double-counted.
- **Shortcut recipe**: `docs/health-sync-shortcut.md` — step-by-step iOS Shortcut (Find
  Health Samples → today's steps, active energy, latest weight → Get Contents of URL POST
  JSON), plus how to schedule it as a daily evening automation. Chat/screenshot workout
  logging remains as fallback.

## 9. Migration (additive)

`supabase/migrations/002_v2.sql`:

```sql
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  type text not null,             -- 'weekly_review' | 'target_suggestion' | ...
  period_key text not null,       -- e.g. '2026-W24'
  content jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, type, period_key)
);
-- + RLS policies matching existing tables
```

## 10. Execution batches (each: build → verify → commit)

| # | Batch | Contents |
|---|-------|----------|
| 0 | Prep | Commit the two pending working-tree changes (weight sync on profile update; coach nudge removal) |
| 1 | AI reliability | `lib/ai/client.ts` retry/fallback, typed errors, retry button in chat, coach streaming, staged progress for food logging, call audit |
| 2 | Design system | Fonts, tokens, primitives (StatNumeral, HairlineCard, MicroLabel, restyled CalorieRing/MacroBar), app shell + tab bar redesign |
| 3 | Dashboard/Log | Full redesign incl. protein-first countdown + banking strip; data cache + optimistic updates |
| 4 | Chat | Full redesign; staged progress UX; food cards/strips restyled |
| 5 | Progress + analytics | Full redesign; weight trend, TDEE back-calc, goal ETA, compliance, food patterns; migration 002 lands here |
| 6 | Adaptive targets | Suggestion engine + card UI + apply/dismiss flow |
| 7 | Coach + Settings | Redesign both; coach digest; weekly review (DB-cached) |
| 8 | Health sync | Endpoint + service-role client + Shortcut recipe doc |

**Verification per batch**: `npm run build` passes; Playwright (or dev-server screenshot)
check of affected screens at 390×844 viewport; for API batches, curl the endpoint locally.
Design batches use the frontend-design skill.

## Error handling principles

- AI failures are always recoverable in-UI (retry button), never silent, never dead-end.
- Analytics with insufficient data render explicit "needs more data" states, never NaN.
- Optimistic updates roll back visibly with a brief error note on failure.
- health-sync validates payload shape; bad fields are ignored, not fatal.
