# Calorie Tracker v2 — "Editorial Instrument" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved spec at `docs/superpowers/specs/2026-06-12-calorie-tracker-v2-design.md` — full "Editorial Instrument" redesign, Gemini reliability + prompt overhaul, budget model v2, analytics suite, adaptive targets, calorie banking, coach digest, Apple Health sync.

**Architecture:** Next.js 16 App Router + Supabase + Gemini (`@google/generative-ai`). All new intelligence is pure math in `lib/utils/*` (unit-tested with vitest); AI calls go through one new wrapper `lib/ai/client.ts`; the redesign is a token/primitive system in `globals.css` + `components/ui/` applied screen-by-screen.

**Tech Stack:** TypeScript, Tailwind v4, Recharts, vitest (new, dev-only), Gemini `gemini-3.5-flash` with structured output.

**Read the spec first.** Every task below implements a spec section; the spec is the source of truth for intent.

**Hard rules for the whole plan:**
- NO automatic/background Gemini calls. Every AI call is user-initiated or read from DB cache.
- Chat API stays on Edge runtime, total response < 25s.
- The user is a single person (Kyle). No multi-user features. No onboarding flow (deliberately removed — never re-add).
- Every task ends with `npm run build` passing and a commit. UI tasks additionally verified in a real browser at 390×844 (iPhone) viewport.
- **Redesign tasks (Batches 2–4, and the UI halves of 5–7) MUST be done with the frontend-design skill** using the design language defined in Task 9.

---

## Batch 0 — Prep

### Task 0: Commit pending working-tree changes

Two intentional uncommitted changes exist: weight-sync on profile update (`app/(app)/chat/page.tsx`) and weekly-nudge removal (`app/(app)/coach/page.tsx`).

- [ ] **Step 1:** `git status --short` — confirm only those two files are modified.
- [ ] **Step 2:** `npm run build` — expect success.
- [ ] **Step 3:** Commit:

```bash
git add "app/(app)/chat/page.tsx" "app/(app)/coach/page.tsx"
git commit -m "feat: sync weight entry on profile weight update; remove coach weekly nudge UI"
```

---

## Batch 1 — Correctness foundation

### Task 1: vitest setup

**Files:** Modify `package.json`; Create `vitest.config.ts`

- [ ] **Step 1:** `npm install -D vitest`
- [ ] **Step 2:** Add script to `package.json`: `"test": "vitest run"`
- [ ] **Step 3:** Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
})
```

- [ ] **Step 4:** Create a trivial smoke test `lib/utils/format.test.ts` asserting an existing pure function in `lib/utils/format.ts` (read the file, pick one, e.g. `offsetDate('2026-06-10', 1) === '2026-06-11'`). Run `npm test` — expect 1 pass.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "chore: add vitest"`

### Task 2: Europe/London date helper + UTC sweep

**Files:** Create `lib/utils/dates.ts`, `lib/utils/dates.test.ts`; Modify every API file using `toISOString().split('T')[0]` for "today/range" (found in: `app/api/entries/route.ts`, `app/api/entries/all/route.ts`, `app/api/entries/copy-yesterday/route.ts`, `app/api/activity/route.ts`, `app/api/weekly-summary/route.ts`, `app/api/coach/route.ts`, `lib/db/queries.ts` lines ~87/96/111)

Server routes currently compute "today" in UTC; Kyle logs late-night in London, so during BST entries land on the wrong date.

- [ ] **Step 1:** Write failing tests `lib/utils/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { todayLondon, addDays, isoWeekKey, daysAgoLondon } from './dates'

describe('dates', () => {
  it('todayLondon returns YYYY-MM-DD', () => {
    expect(todayLondon()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('addDays does pure string date math', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31')
  })
  it('isoWeekKey computes ISO week', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01')
    expect(isoWeekKey('2026-06-12')).toBe('2026-W24')
  })
  it('daysAgoLondon offsets from today', () => {
    expect(daysAgoLondon(0)).toBe(todayLondon())
  })
})
```

- [ ] **Step 2:** `npm test` — expect FAIL (module not found).
- [ ] **Step 3:** Implement `lib/utils/dates.ts`:

```ts
const LONDON_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }) // en-CA → YYYY-MM-DD

export function todayLondon(): string {
  return LONDON_FMT.format(new Date())
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`) // noon UTC avoids DST edges
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

export function daysAgoLondon(days: number): string {
  return addDays(todayLondon(), -days)
}

export function isoWeekKey(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // Thursday of this week determines the ISO year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Monday of the week containing isoDate */
export function weekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  const day = d.getUTCDay() || 7
  return addDays(isoDate, -(day - 1))
}
```

- [ ] **Step 4:** `npm test` — expect PASS.
- [ ] **Step 5:** Sweep: replace every server-side `new Date().toISOString().split('T')[0]` / `new Date(Date.now() - N*86400000).toISOString()...` used for *calendar dates* with `todayLondon()` / `daysAgoLondon(N)` / `addDays(...)` in the files listed above. Leave `updated_at` timestamps (`lib/db/queries.ts:16,24`) alone — those are real timestamps, not dates. In `app/api/weekly-summary/route.ts` replace the Monday/Sunday computation with `weekStart(todayLondon())` and `addDays(weekStart(...), 6)` (previous week = `addDays(..., -7)`).
- [ ] **Step 6:** `npm run build` — expect success. Commit: `git commit -am "fix: Europe/London date handling across API routes"`

### Task 3: Migration 002 + type updates

**Files:** Create `supabase/migrations/002_v2.sql`; Modify `lib/db/types.ts`

- [ ] **Step 1:** Create `supabase/migrations/002_v2.sql` (mirror RLS style from `001_initial.sql` — read it first):

```sql
-- v2: budget knobs + cached insights

alter table public.user_profiles
  add column if not exists baseline_steps int not null default 5000,
  add column if not exists earn_back_rate numeric not null default 0.75;

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,        -- 'weekly_review' | 'target_suggestion'
  period_key text not null,  -- ISO week, e.g. '2026-W24'
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, type, period_key)
);

alter table public.insights enable row level security;

create policy "Users manage own insights" on public.insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

(Adjust policy syntax to exactly match the per-operation policy style used in `001_initial.sql` if it differs.)

- [ ] **Step 2:** In `lib/db/types.ts` add to `UserProfile`: `baseline_steps: number` and `earn_back_rate: number`; add:

```ts
export type Insight = {
  id: string
  user_id: string
  type: 'weekly_review' | 'target_suggestion'
  period_key: string
  content: Record<string, unknown>
  created_at: string
}
```

- [ ] **Step 3:** Apply the migration to Supabase. Try `npx supabase db push` if the CLI is linked; otherwise STOP and ask the user to paste the SQL into the Supabase SQL editor, and wait for confirmation before continuing (later tasks read these columns).
- [ ] **Step 4:** Check `app/(app)/chat/page.tsx` for the `SEED_PROFILE` constant — if it constructs a full profile object, the new columns have DB defaults so no change is needed; verify profile fetch still works (`npm run dev`, open /dashboard, no console errors).
- [ ] **Step 5:** `npm run build`; commit: `git commit -am "feat: migration 002 — budget knobs + insights table"`

### Task 4: Budget model v2

**Files:** Modify `lib/utils/calories.ts`; Create `lib/utils/calories.test.ts`; Modify consumers: `app/(app)/dashboard/page.tsx`, `components/CalorieRing.tsx`, `lib/ai/chat-dispatcher.ts`, `app/api/weekly-summary/route.ts`, `lib/db/queries.ts` (`computeStreak`)

Spec §2c. Steps above a baseline earn at 75%; workouts credited at 75%; one TDEE helper.

- [ ] **Step 1:** Write failing tests `lib/utils/calories.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getEffectiveTdee, getBudgetBreakdown } from './calories'

const profile = {
  tdee: 2100, bmr: 1755, weight_kg: 83, deficit_amount: 600,
  baseline_steps: 5000, earn_back_rate: 0.75,
}

describe('budget model v2', () => {
  it('getEffectiveTdee falls back to bmr*1.2', () => {
    expect(getEffectiveTdee({ tdee: 2100, bmr: 1755 })).toBe(2100)
    expect(getEffectiveTdee({ tdee: undefined, bmr: 1755 })).toBe(2106)
  })
  it('steps below baseline earn nothing', () => {
    const b = getBudgetBreakdown(profile, 4000, 0)
    expect(b.stepsBonus).toBe(0)
    expect(b.total).toBe(1500)
  })
  it('10k steps + stairmaster lands near stated workout-day target', () => {
    const b = getBudgetBreakdown(profile, 10000, 200)
    // (10000-5000) * 0.000571 * 83 * 0.75 ≈ 178; 200*0.75 = 150
    expect(b.stepsBonus).toBe(178) // (10000−5000) × 0.000571 × 83 × 0.75
    expect(b.workoutBonus).toBe(150)
    expect(b.total).toBe(1828) // 1500 + 178 + 150
  })
  it('missing knobs default to 5000 / 0.75', () => {
    const b = getBudgetBreakdown({ ...profile, baseline_steps: undefined, earn_back_rate: undefined } as never, 10000, 0)
    expect(b.stepsBonus).toBe(178)
  })
})
```

- [ ] **Step 2:** `npm test` — FAIL (functions not exported).
- [ ] **Step 3:** Implement in `lib/utils/calories.ts` (keep existing exports; `stepsToCalories` stays for storing gross step kcal):

```ts
export type BudgetBreakdown = {
  effectiveTdee: number
  deficit: number
  baseTarget: number
  stepsCount: number
  baselineSteps: number
  stepsBonus: number
  workoutCalories: number
  workoutBonus: number
  earnBackRate: number
  total: number
}

type TdeeFields = { tdee?: number; bmr: number }
type BudgetProfile = TdeeFields & {
  weight_kg: number
  deficit_amount: number
  baseline_steps?: number
  earn_back_rate?: number
}

export function getEffectiveTdee(p: TdeeFields): number {
  return Math.round(p.tdee || p.bmr * 1.2)
}

export function getBudgetBreakdown(p: BudgetProfile, stepsCount: number, workoutCalories: number): BudgetBreakdown {
  const effectiveTdee = getEffectiveTdee(p)
  const baselineSteps = p.baseline_steps ?? 5000
  const earnBackRate = p.earn_back_rate ?? 0.75
  const baseTarget = effectiveTdee - p.deficit_amount
  const stepsBonus = Math.round(Math.max(0, stepsCount - baselineSteps) * 0.000571 * p.weight_kg * earnBackRate)
  const workoutBonus = Math.round(workoutCalories * earnBackRate)
  return {
    effectiveTdee, deficit: p.deficit_amount, baseTarget,
    stepsCount, baselineSteps, stepsBonus,
    workoutCalories, workoutBonus, earnBackRate,
    total: baseTarget + stepsBonus + workoutBonus,
  }
}
```

Delete the old `getDailyBudget` and fix every compile error by switching callers to `getBudgetBreakdown(profile, activity?.steps_count ?? 0, activity?.workout_calories ?? 0).total` (pass the breakdown object where the UI needs the chain — `CalorieRing` gets it in Task 12; for now adapt its props minimally so build passes). In `computeStreak` (`lib/db/queries.ts`) use `getEffectiveTdee` + base target (no activity) — read the function and preserve its existing comparison semantics otherwise. In `weekly-summary`, per-day budget must now include that day's activity: fetch `getActivityRange` for the week and compute each day's `getBudgetBreakdown(...)` (full rebuild happens in Task 17; here just keep it compiling and per-day-correct).

- [ ] **Step 4:** `npm test` && `npm run build` — PASS.
- [ ] **Step 5:** Commit: `git commit -am "feat: budget model v2 — baseline steps + earn-back rate"`

### Task 5: Gemini client wrapper (retry / fallback / typed errors)

**Files:** Create `lib/ai/client.ts`, `lib/ai/client.test.ts`; Modify `lib/ai/gemini.ts`

- [ ] **Step 1:** Verify available fallback model: `curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | grep -o '"name": "models/gemini[^"]*"' | sort -u` (load the key from `.env.local`). Pick the current flash-lite-class model (e.g. `gemini-3.5-flash-lite` if listed). Record it as `FALLBACK_MODEL_ID` below.
- [ ] **Step 2:** Write failing tests `lib/ai/client.test.ts` (inject fake callers — no network):

```ts
import { describe, it, expect } from 'vitest'
import { generateWithRetry, classifyGeminiError } from './client'

const ok = async () => ({ text: '{"a":1}' })
const cap = (status: number) => async () => { const e = new Error(`got ${status}`) as Error & { status: number }; e.status = status; throw e }

describe('generateWithRetry', () => {
  it('returns ok on first success', async () => {
    const r = await generateWithRetry([ok], 'x', { retries: 1, baseDelayMs: 1 })
    expect(r).toEqual({ ok: true, text: '{"a":1}', modelIndex: 0 })
  })
  it('retries capacity errors then falls back to next model', async () => {
    let calls = 0
    const flaky = async () => { calls++; const e = new Error('503 overloaded') as Error & { status: number }; e.status = 503; throw e }
    const r = await generateWithRetry([flaky, ok], 'x', { retries: 1, baseDelayMs: 1 })
    expect(calls).toBe(2) // initial + 1 retry on model 0
    expect(r).toEqual({ ok: true, text: '{"a":1}', modelIndex: 1 })
  })
  it('returns typed failure when all models exhausted', async () => {
    const r = await generateWithRetry([cap(429)], 'x', { retries: 1, baseDelayMs: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('rate_limit')
  })
  it('does not retry non-capacity errors', async () => {
    let calls = 0
    const bad = async () => { calls++; throw new Error('invalid argument') }
    const r = await generateWithRetry([bad], 'x', { retries: 2, baseDelayMs: 1 })
    expect(calls).toBe(1)
    if (!r.ok) expect(r.error).toBe('unknown')
  })
})

describe('classifyGeminiError', () => {
  it('classifies 429/quota as rate_limit', () => {
    expect(classifyGeminiError(new Error('429 Too Many Requests'))).toBe('rate_limit')
    expect(classifyGeminiError(new Error('RESOURCE_EXHAUSTED: quota'))).toBe('rate_limit')
  })
  it('classifies 503/overloaded as overloaded', () => {
    expect(classifyGeminiError(new Error('The model is overloaded'))).toBe('overloaded')
  })
})
```

- [ ] **Step 3:** `npm test` — FAIL. Implement `lib/ai/client.ts`:

```ts
export type AIErrorKind = 'rate_limit' | 'overloaded' | 'parse' | 'unknown'
export type AIResult =
  | { ok: true; text: string; modelIndex: number }
  | { ok: false; error: AIErrorKind; detail: string }

export function classifyGeminiError(err: unknown): AIErrorKind {
  const status = (err as { status?: number })?.status
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('resource exhausted') || msg.includes('too many requests')) return 'rate_limit'
  if (status === 503 || msg.includes('503') || msg.includes('overloaded') || msg.includes('service unavailable') || msg.includes('high demand')) return 'overloaded'
  return 'unknown'
}

type Caller = () => Promise<{ text: string }>
type Opts = { retries?: number; baseDelayMs?: number }

/**
 * Tries each caller (one per model, primary first). Capacity errors retry with
 * jittered backoff `retries` times per model, then fall through to the next model.
 * Non-capacity errors fail immediately. Total budget must stay well under the
 * 25s Edge limit: defaults are 1 retry, ~1s base delay → worst case ≈ 2 calls
 * per model + ~2s sleeping.
 */
export async function generateWithRetry(callers: Caller[], _label: string, opts: Opts = {}): Promise<AIResult> {
  const retries = opts.retries ?? 1
  const baseDelayMs = opts.baseDelayMs ?? 1000
  let lastKind: AIErrorKind = 'unknown'
  let lastDetail = ''
  for (let m = 0; m < callers.length; m++) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { text } = await callers[m]()
        return { ok: true, text, modelIndex: m }
      } catch (err) {
        lastKind = classifyGeminiError(err)
        lastDetail = err instanceof Error ? err.message : String(err)
        if (lastKind === 'unknown' || lastKind === 'parse') return { ok: false, error: lastKind, detail: lastDetail }
        if (attempt < retries) await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1) + Math.random() * 250))
      }
    }
  }
  return { ok: false, error: lastKind, detail: lastDetail }
}
```

- [ ] **Step 4:** In `lib/ai/gemini.ts`, export model factories so call sites can build primary+fallback caller pairs (keep existing exports working):

```ts
export const PRIMARY_MODEL = 'gemini-3.5-flash'
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || '<FALLBACK_MODEL_ID from Step 1>'

export function makeModel(modelId: string, opts: { json?: boolean; schema?: object; temperature?: number; systemInstruction?: string }) {
  return genAI.getGenerativeModel({
    model: modelId,
    ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      ...(opts.schema ? { responseSchema: opts.schema } : {}),
      thinkingConfig: { thinkingBudget: 1024 },
    } as GenerationConfigWithThinking,
  })
}
```

- [ ] **Step 5:** `npm test` && `npm run build` — PASS. Commit: `git commit -am "feat: Gemini client wrapper — retry, model fallback, typed errors"`

### Task 6: Dispatcher prompt overhaul

**Files:** Modify `lib/ai/chat-dispatcher.ts`, `app/api/chat/route.ts`

Spec §2b. Structured output schema, few-shots, calibration rules, persona from live profile, structured session recap, no model arithmetic.

- [ ] **Step 1:** In `lib/ai/chat-dispatcher.ts`, define the flat response schema (Gemini's schema subset doesn't do discriminated unions — use one object with optional fields keyed by `intent`):

```ts
import { SchemaType } from '@google/generative-ai'

const foodItemSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING }, brand: { type: SchemaType.STRING },
    serving_size: { type: SchemaType.STRING }, serving_unit: { type: SchemaType.STRING },
    calories: { type: SchemaType.NUMBER }, protein: { type: SchemaType.NUMBER },
    carbs: { type: SchemaType.NUMBER }, fat: { type: SchemaType.NUMBER },
    fiber: { type: SchemaType.NUMBER }, sugar: { type: SchemaType.NUMBER },
    sodium: { type: SchemaType.NUMBER }, saturated_fat: { type: SchemaType.NUMBER },
    cholesterol: { type: SchemaType.NUMBER }, commentary: { type: SchemaType.STRING },
  },
  required: ['name', 'serving_size', 'serving_unit', 'calories', 'protein', 'carbs', 'fat', 'commentary'],
}

export const chatResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    intent: { type: SchemaType.STRING, format: 'enum', enum: ['food_log', 'workout', 'steps', 'question', 'profile_update_pending'] },
    message: { type: SchemaType.STRING },
    items: { type: SchemaType.ARRAY, items: foodItemSchema },
    activeCalories: { type: SchemaType.NUMBER },
    steps: { type: SchemaType.NUMBER },
    updates: {
      type: SchemaType.OBJECT,
      properties: {
        goal: { type: SchemaType.STRING }, deficit_amount: { type: SchemaType.NUMBER },
        tdee: { type: SchemaType.NUMBER }, target_calories: { type: SchemaType.NUMBER },
        weight_kg: { type: SchemaType.NUMBER }, activity_level: { type: SchemaType.STRING },
        protein_target_g: { type: SchemaType.NUMBER }, carbs_target_g: { type: SchemaType.NUMBER },
        fat_target_g: { type: SchemaType.NUMBER },
      },
    },
  },
  required: ['intent', 'message'],
} as const
```

- [ ] **Step 2:** Rebuild the system prompt. Replace `PERSONA` and the prompt body with (note: every number comes from the live profile / breakdown — nothing hardcoded):

```ts
function buildSystemPrompt(profile: UserProfile, b: BudgetBreakdown, todayContext: DailyContext, today: string, sessionItems: string) {
  const remaining = b.total - todayContext.caloriesEaten
  const proteinLeft = Math.max(0, profile.protein_target_g - todayContext.proteinEaten)
  return `You are the AI engine of a personal calorie-tracking app for one user.

PERSONA: Direct, honest, data-driven nutrition advisor. No sugar-coating, no cheerleading. Straight facts and numbers. Metric units only (kg, km, ml). Weekly average beats daily perfection; minor overages are not emergencies. No guilt workouts — if mentally exhausted, recommend sleep. Muscle over scale weight: protein floor comes before the calorie ceiling.

USER STATE (today ${today}):
- Base target: ${b.baseTarget} kcal (TDEE ${b.effectiveTdee} − deficit ${b.deficit})
- Activity earn-back today: +${b.stepsBonus} kcal steps (above a ${b.baselineSteps}-step baseline, credited at ${Math.round(b.earnBackRate * 100)}%), +${b.workoutBonus} kcal workouts
- Today's budget: ${b.total} kcal · eaten ${todayContext.caloriesEaten} · remaining ${remaining}
- Protein: ${todayContext.proteinEaten}g of ${profile.protein_target_g}g floor (${proteinLeft}g to go). Carbs ${todayContext.carbsEaten}/${profile.carbs_target_g}g, Fat ${todayContext.fatEaten}/${profile.fat_target_g}g.
- Weight ${profile.weight_kg} kg, goal ${profile.goal}.
${sessionItems ? `\nITEMS LOGGED THIS SESSION (for corrections):\n${sessionItems}\n` : ''}
TASK: Classify the user's input into exactly one intent and fill ONLY that intent's fields.

- food_log — they describe or photograph food they ate. Fill "items".
  ESTIMATION RULES:
  * Assume UK/London portions and brands (Pret, Tesco meal deal, Nando's, pub servings) unless told otherwise.
  * State your portion assumption in "commentary" (1–2 sentences) so the user can fact-check.
  * Self-check before answering: protein×4 + carbs×4 + fat×9 must be within 10% of calories. Adjust until it is.
  * If the user corrects a just-logged item ("it was a large"), return the corrected item(s), not a duplicate.
- workout — they describe a workout or send an Apple Health screenshot. Fill "activeCalories" (read it off the screenshot if present).
- steps — they report a step count. Fill "steps" with the integer ONLY. Do not compute calories; the server does that.
- profile_update_pending — they want to change goal/weight/deficit/macros. Fill "updates" with ONLY the changing fields; keep deficit_amount and target_calories in sync (target = TDEE − deficit); state the proposed change in "message" ending with "Confirm?".
- question — anything else. Answer in "message", concise and direct, citing their numbers above.

EXAMPLES (static, illustrative numbers):
User: "chicken wrap and a flat white"
→ {"intent":"food_log","message":"Logged both.","items":[{"name":"Chicken wrap","serving_size":"1","serving_unit":"wrap","calories":420,"protein":28,"carbs":42,"fat":14,"fiber":3,"sugar":4,"sodium":680,"saturated_fat":4,"cholesterol":70,"commentary":"Assumed a standard UK grab-and-go wrap (~200g). Check: 28×4+42×4+14×9=406 ≈ 420."},{"name":"Flat white","serving_size":"1","serving_unit":"cup","calories":120,"protein":6,"carbs":9,"fat":7,"fiber":0,"sugar":9,"sodium":75,"saturated_fat":4.5,"cholesterol":25,"commentary":"Whole-milk flat white, ~240ml."}]}
User: "actually the wrap was a large one"
→ {"intent":"food_log","message":"Updated to a large wrap.","items":[{"name":"Chicken wrap (large)","serving_size":"1","serving_unit":"wrap","calories":560,"protein":36,"carbs":56,"fat":19,"fiber":4,"sugar":5,"sodium":900,"saturated_fat":5,"cholesterol":90,"commentary":"Scaled to a large (~270g) wrap. Check: 36×4+56×4+19×9=539 ≈ 560."}]}
User: "12,400 steps today"
→ {"intent":"steps","message":"Steps recorded.","steps":12400}`
}
```

`sessionItems` is built by the route from this session's confirmed items (name + kcal + P/C/F, one per line) — add a `sessionItems: { name: string; calories: number; protein: number; carbs: number; fat: number }[]` param to `dispatchChat`, passed from the client alongside history (the chat page already holds confirmed items in state; send the last 10).

- [ ] **Step 3:** Wire it: `dispatchChat` builds the model via `makeModel(PRIMARY_MODEL, { json: true, schema: chatResponseSchema })` and a fallback via `makeModel(FALLBACK_MODEL, ...)`, calls `generateWithRetry([() => primary.generateContent(parts).then(r => ({ text: r.response.text() })), () => fallback...], 'chat')`. On `ok:false` return the typed error to the route (change `dispatchChat` return type to `ChatResponse | { aiError: AIErrorKind }`). Map the flat JSON to the `ChatResponse` union; for `intent==='steps'` compute `stepsCalories = stepsToCalories(steps, profile.weight_kg)` server-side; wrap `JSON.parse` so failures return `{ aiError: 'parse' }`.
- [ ] **Step 4:** In `app/api/chat/route.ts`: pass `sessionItems` through; when dispatcher returns `aiError`, respond `{ error: kind }` with status 429 (`rate_limit`) / 503 (`overloaded`) / 502 (`parse`/`unknown`). Keep the existing catch as last resort.
- [ ] **Step 5:** Manual verification (`npm run dev`): log "chicken wrap and flat white" → items appear with commentary containing a portion assumption and a macro check; say "I did 8,000 steps" → steps logged with server-computed kcal; ask "how am I doing today" → direct answer citing the real budget.
- [ ] **Step 6:** `npm run build`; commit: `git commit -am "feat: dispatcher v2 — structured output, few-shots, calibration, live-profile persona"`

### Task 7: Chat UX — retry button + staged progress

**Files:** Modify `app/(app)/chat/page.tsx`, `components/ChatMessage.tsx` (read both fully first)

- [ ] **Step 1:** In the chat page's send handler, keep the last request payload in a ref (`lastPayloadRef`). On fetch failure or `{error}` response, append a message of a new type `{ type: 'error', kind: 'rate_limit' | 'overloaded' | 'other' }` instead of a dead text message.
- [ ] **Step 2:** Render error messages as a card: copy `"Gemini is busy right now."` (rate_limit: `"Gemini free-tier limit hit — wait ~30s."`) with a **Tap to retry** button that re-sends `lastPayloadRef.current` and removes the error message. Haptic on tap.
- [ ] **Step 3:** Staged progress: while awaiting the response, show a thinking indicator that cycles through stages — text input: `Estimating macros…`; with images: `Reading photo… → Estimating macros…` (switch after ~2.5s via timeout); plus a skeleton food-card shimmer below it. Implement as a small `ThinkingIndicator` component inside the chat page or `components/ChatMessage.tsx`.
- [ ] **Step 4:** Verify in dev: send a message, observe stages; simulate failure (temporarily set a bogus `GEMINI_API_KEY` in `.env.local`, restart dev) → error card with working retry after restoring the key. Restore the key.
- [ ] **Step 5:** `npm run build`; commit: `git commit -am "feat: chat retry affordance + staged progress"`

### Task 8: Dead code + call audit

**Files:** Delete `app/api/coaching-nudge/route.ts`; review all other Gemini call sites

- [ ] **Step 1:** `rm -r app/api/coaching-nudge` (confirmed unreferenced).
- [ ] **Step 2:** Migrate the remaining direct Gemini calls to the Task 5 wrapper with fallback: `app/api/serving-size/route.ts` (add a response schema: `{servings: number, explanation: string}`), `lib/ai/tdee.ts` (`chatAboutTDEE` — check callers with grep; if nothing references it or `calculateTDEEWithAI` anymore, delete the dead exports instead). `app/api/coach/route.ts` and `app/api/weekly-summary/route.ts` are rebuilt in Tasks 17/19 — leave them.
- [ ] **Step 3:** Grep for any AI call not triggered by a user action (`grep -rn "generateContent\|sendMessage" app/ lib/`) — confirm each is user-initiated. List findings in the commit message.
- [ ] **Step 4:** `npm run build`; commit: `git commit -am "chore: delete dead coaching-nudge route; migrate stragglers to AI client"`

---

## Batch 2 — Design system (frontend-design skill REQUIRED from here through Batch 4)

### Task 9: Tokens, fonts, primitives

**Files:** Modify `app/globals.css`, `app/layout.tsx`; Create `components/ui/StatNumeral.tsx`, `components/ui/MicroLabel.tsx`, `components/ui/HairlineCard.tsx`

The design language — **"Editorial Instrument"**: Vogue meets a Swiss instrument panel. Bone ivory on warm near-black, ONE accent (acid chartreuse), serif display numerals, hairline rules, sharp corners, generous whitespace. No gradients, no glows, no glassmorphism, no emoji in chrome (emoji in user content is fine).

- [x] **Step 1:** In `app/layout.tsx` load fonts:

```tsx
import { Instrument_Serif } from 'next/font/google'
const instrument = Instrument_Serif({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-display' })
// add `${instrument.variable}` to the <body> className
```

- [x] **Step 2:** Replace the `:root` block in `app/globals.css`:

```css
:root {
  --bg: #0A0A09;
  --ink: #F2EFE6;
  --ink-60: rgba(242, 239, 230, 0.6);
  --muted: #8A8678;
  --hairline: rgba(242, 239, 230, 0.12);
  --hairline-strong: rgba(242, 239, 230, 0.24);
  --accent: #C8FF1C;
  --accent-ink: #0A0A09;   /* text on accent fills */
  --danger: #E0452B;
  --radius: 6px;
}
body { background: var(--bg); color: var(--ink); /* keep existing font stack + smoothing */ }
.font-display { font-family: var(--font-display), Georgia, serif; }
.micro-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.hairline-t { border-top: 1px solid var(--hairline); }
.tnum { font-variant-numeric: tabular-nums; }
```

- [x] **Step 3:** Primitives (full code; keep them dumb):

`components/ui/MicroLabel.tsx`
```tsx
export default function MicroLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`micro-label ${className}`}>{children}</div>
}
```

`components/ui/StatNumeral.tsx`
```tsx
type Props = { value: string | number; label: string; size?: 'hero' | 'lg' | 'md'; tone?: 'ink' | 'accent' | 'danger'; suffix?: string }
const SIZES = { hero: 'text-[64px] leading-none', lg: 'text-[40px] leading-none', md: 'text-[26px] leading-none' }
const TONES = { ink: 'text-[var(--ink)]', accent: 'text-[var(--accent)]', danger: 'text-[var(--danger)]' }
export default function StatNumeral({ value, label, size = 'md', tone = 'ink', suffix }: Props) {
  return (
    <div>
      <div className={`font-display tnum ${SIZES[size]} ${TONES[tone]}`}>
        {value}{suffix && <span className="text-[0.45em] text-[var(--muted)] ml-1">{suffix}</span>}
      </div>
      <div className="micro-label mt-1.5">{label}</div>
    </div>
  )
}
```

`components/ui/HairlineCard.tsx`
```tsx
export default function HairlineCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-[var(--hairline)] rounded-[var(--radius)] bg-transparent ${className}`}>{children}</div>
}
```

- [x] **Step 4:** Restyle `components/CalorieRing.tsx` and `components/MacroBar.tsx` to the language (full redesign of these two components now, since every later screen uses them):
  - **CalorieRing v2 props:** `{ eaten: number; breakdown: BudgetBreakdown }`. Thin 3px track in `--hairline-strong`, progress arc in `--accent` (flat butt caps, no rounding), `--danger` arc when over. Center: **remaining** as the hero (`StatNumeral` hero size, accent tone; when over: the overage with tone danger and label "OVER"), `eaten / total` as a small `tnum` line beneath. **No color change at 85%** — accent until genuinely over. Delete the in-component "How your budget is built" card entirely (breakdown moves to a tap-to-open sheet in Task 12).
  - **MacroBar v2:** protein is a floor — bar fills toward the floor, shows "Xg to go" then "✓ floor hit" (accent) when reached; carbs/fat are caps — thin bars, `--danger` fill only when over cap; all bars 2px tall hairline-track style. Accept an optional `carbHeadroom?: number` prop (computed in Task 12).
- [x] **Step 5:** Fix prop call sites so the build passes. `npm run build`. Verify dashboard in browser at 390×844 — new ring/macros render.
- [x] **Step 6:** Commit: `git commit -am "feat: Editorial Instrument design system — tokens, fonts, primitives, ring+macros v2"`

### Task 10: App shell + tab bar

**Files:** Modify `app/(app)/layout.tsx`, `app/(auth)/login/page.tsx`

- [x] **Step 1:** Redesign the tab bar: background `--bg` with a 1px `--hairline` top rule (drop the zinc blur pill look); active tab = `--accent` icon + label, inactive = `--muted`; active indicator = 1px accent rule at the very top of the bar above the active tab (not a pill). Keep existing SVG icons and safe-area padding. Labels in `micro-label` style.
- [x] **Step 2:** Login page: restyle to the language — app name set in `font-display` italic as a wordmark, bone-on-black, hairline input, accent submit button (`--accent` fill, `--accent-ink` text).
- [x] **Step 3:** Browser-verify both at 390×844. `npm run build`; commit: `git commit -am "feat: shell + login in Editorial Instrument language"`

---

## Batch 3 — Dashboard

### Task 11: Cached fetch + optimistic mutation hook

**Files:** Create `lib/utils/useCachedFetch.ts`, `lib/utils/cache.ts`, `lib/utils/cache.test.ts`

- [x] **Step 1:** Tests for the cache core (pure, no React) `lib/utils/cache.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SwrCache } from './cache'

describe('SwrCache', () => {
  it('stores and returns values', () => {
    const c = new SwrCache()
    c.set('k', { a: 1 })
    expect(c.get('k')).toEqual({ a: 1 })
  })
  it('invalidate by prefix clears matching keys only', () => {
    const c = new SwrCache()
    c.set('/api/entries?date=2026-06-12', 1)
    c.set('/api/entries?date=2026-06-11', 2)
    c.set('/api/profile', 3)
    c.invalidatePrefix('/api/entries')
    expect(c.get('/api/entries?date=2026-06-12')).toBeUndefined()
    expect(c.get('/api/profile')).toBe(3)
  })
})
```

- [x] **Step 2:** Implement `lib/utils/cache.ts`:

```ts
export class SwrCache {
  private map = new Map<string, unknown>()
  get<T>(key: string): T | undefined { return this.map.get(key) as T | undefined }
  set(key: string, value: unknown) { this.map.set(key, value) }
  invalidatePrefix(prefix: string) {
    for (const k of this.map.keys()) if (k.startsWith(prefix)) this.map.delete(k)
  }
}
export const appCache = new SwrCache()
```

- [x] **Step 3:** Implement `lib/utils/useCachedFetch.ts`:

```ts
'use client'
import { useEffect, useState, useCallback } from 'react'
import { appCache } from './cache'

export function useCachedFetch<T>(url: string | null) {
  const cached = url ? appCache.get<T>(url) : undefined
  const [data, setData] = useState<T | undefined>(cached)
  const [loading, setLoading] = useState(!cached)

  const refresh = useCallback(async () => {
    if (!url) return
    const res = await fetch(url)
    if (res.ok) {
      const json = (await res.json()) as T
      appCache.set(url, json)
      setData(json)
    }
    setLoading(false)
  }, [url])

  useEffect(() => {
    setData(url ? appCache.get<T>(url) : undefined)
    setLoading(url ? !appCache.get(url) : false)
    refresh() // stale-while-revalidate: render cache instantly, refetch in background
  }, [url, refresh])

  return { data, loading, refresh }
}
```

- [x] **Step 4:** `npm test` && `npm run build`; commit: `git commit -am "feat: SWR-style cache + hook"`

### Task 12: Banking math + dashboard redesign

**Files:** Create `lib/utils/banking.ts`, `lib/utils/banking.test.ts`, `app/api/week/route.ts`; Rewrite `app/(app)/dashboard/page.tsx` (use frontend-design skill); Modify `components/FoodCard.tsx`, `components/ActivityStrip.tsx`, `components/WaterTracker.tsx` (restyle pass)

- [x] **Step 1:** Banking tests `lib/utils/banking.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeWeekBank } from './banking'

const day = (date: string, eaten: number, budget: number) => ({ date, eaten, budget })

describe('computeWeekBank', () => {
  it('banks unspent budget from elapsed days, excluding today', () => {
    const r = computeWeekBank([day('2026-06-08', 1400, 1500), day('2026-06-09', 1700, 1500)], '2026-06-10', 1500)
    expect(r.bank).toBe(-100) // +100 then −200
    expect(r.effectiveTodayAllowance).toBe(1400)
  })
  it('floors effective allowance at 1200', () => {
    const r = computeWeekBank([day('2026-06-08', 2400, 1500)], '2026-06-09', 1500)
    expect(r.effectiveTodayAllowance).toBe(1200)
  })
})
```

- [x] **Step 2:** Implement `lib/utils/banking.ts`:

```ts
import { weekStart } from './dates'

export type DayLedger = { date: string; eaten: number; budget: number }
export type WeekBank = {
  weekStart: string
  bank: number                      // Σ(budget − eaten) over elapsed days before `today`
  effectiveTodayAllowance: number   // today's budget + bank, floored at 1200
  days: DayLedger[]
}

export function computeWeekBank(elapsedDays: DayLedger[], today: string, todayBudget: number): WeekBank {
  const ws = weekStart(today)
  const prior = elapsedDays.filter(d => d.date >= ws && d.date < today)
  const bank = Math.round(prior.reduce((s, d) => s + (d.budget - d.eaten), 0))
  return {
    weekStart: ws,
    bank,
    effectiveTodayAllowance: Math.max(1200, Math.round(todayBudget + bank)),
    days: prior,
  }
}
```

- [x] **Step 3:** `npm test` — PASS. Create `app/api/week/route.ts`: GET, takes `?date=`, loads this week's entries (`getFoodEntriesInRange(weekStart, date)`) + activities (`getActivityRange`) + profile, computes per-day `getBudgetBreakdown(...).total` and eaten sums, returns `{ days: DayLedger[], todayBudget }`. Pure data — banking math runs client-side via `computeWeekBank`.
- [x] **Step 4:** Rewrite the dashboard page with the **frontend-design skill**. Required structure top-to-bottom (all data via `useCachedFetch`; all mutations optimistic via `appCache.invalidatePrefix('/api/entries')` etc. then `refresh()`):
  1. **Header**: date as an editorial masthead (e.g. "Friday — 12 June" with `font-display` italic), prev/next day chevrons as bare hairline buttons, streak as a plain `micro-label` ("DAY 14"), weight sparkline kept but recolored.
  2. **Hero**: CalorieRing v2 (remaining is the hero) + beside/below it a `StatNumeral` for **protein to go** at equal visual rank (spec: protein-first). Tapping the ring opens the **budget breakdown sheet** — a bottom sheet/expanding panel rendering the full v2 chain from `BudgetBreakdown`: TDEE − deficit = base · steps line as "STEPS 10,240 · −5,000 baseline → +178 AT 75%" · workout line · total · eaten · remaining. This is the ONLY breakdown UI (the old header toggle + under-ring card are both gone).
  3. **Banking strip**: `HairlineCard` row — "WEEK" micro-label, bank value as `tnum` (+ accent / − danger), 7 hairline mini-bars (one per day, filled height ∝ eaten/budget, accent under, danger over), and "incl. bank: N kcal today" secondary line using `effectiveTodayAllowance`. Data: `/api/week` + `computeWeekBank`.
  4. **MacroBar v2** with `carbHeadroom = Math.round((breakdown.total − protein_target_g*4 − fat_target_g*9) / 4)` displayed as the carb cap for the day.
  5. **ActivityStrip + WaterTracker** restyled (hairline, micro-labels, accent fills; keep all behavior).
  6. **Food log grouped by meal** from `created_at` hour (Europe/London): <11:00 Breakfast, 11:00–15:59 Lunch, 16:00–21:59 Dinner, else Snacks. Each group = `micro-label` header with group kcal `tnum`, entries as restyled `FoodCard`s (hairline rows, name in ink, kcal in `font-display` md). Keep swipe-delete, copy-yesterday, confetti (recolor to `['#C8FF1C', '#F2EFE6']`).
  7. **Manual add**: trim to name + calories + P/C/F (drop serving size/unit — API defaults them: send `serving_size: '1', serving_unit: 'serving'`).
- [x] **Step 5:** Verify in browser at 390×844: instant render from cache on tab revisit; optimistic delete; breakdown sheet math matches `calories.test.ts` expectations; meal groups correct. `npm run build`.
- [x] **Step 6:** Commit: `git commit -am "feat: dashboard v2 — editorial redesign, breakdown sheet, banking, meal groups"`

---

## Batch 4 — Chat

### Task 13: Chat redesign

**Files:** Rewrite styling of `app/(app)/chat/page.tsx`, `components/ChatMessage.tsx`, `components/ChatInput.tsx`, `components/FoodItemCard.tsx`, `components/FavoritesStrip.tsx`, `components/MealTemplatesStrip.tsx`, `components/FoodHistoryStrip.tsx`, `components/FoodHistoryDropdown.tsx`, `components/WorkoutCard.tsx`, `components/StepsCard.tsx`, `components/BarcodeScanner.tsx` (use frontend-design skill; behavior unchanged)

- [ ] **Step 1:** Read all files first. This task is a **restyle, not a rewrite** — every handler, state machine, and API call stays identical. Apply the language: assistant messages as plain ink text with a hairline left rule (no bubbles); user messages right-aligned in `--ink-60`; food item cards as `HairlineCard` with name + serving editable inline as before, kcal in `font-display`, confirm button accent fill; strips (favorites/templates/history) as hairline chips with micro-labels; thinking indicator + retry card from Task 7 restyled to match.
- [ ] **Step 2:** Keep the staged-progress and retry features fully working. In the expanded/detail view of food cards (`components/FoodItemCard.tsx` and `components/FoodCard.tsx`), surface the stored-but-hidden fiber and sugar values as micro-label rows.
- [ ] **Step 3:** Browser-verify the full loop at 390×844: log a meal → cards → edit serving → confirm → dashboard reflects it instantly (cache invalidation from Task 12 list: chat confirm must call `appCache.invalidatePrefix('/api/entries')` and `invalidatePrefix('/api/week')`).
- [ ] **Step 4:** `npm run build`; commit: `git commit -am "feat: chat v2 — editorial restyle"`

---

## Batch 5 — Progress + analytics

### Task 14: Analytics math library

**Files:** Create `lib/utils/analytics.ts`, `lib/utils/analytics.test.ts`

- [ ] **Step 1:** Failing tests `lib/utils/analytics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ewmaTrend, backCalcTdee, goalEta, foodPatterns } from './analytics'

const w = (date: string, kg: number) => ({ date, weight_kg: kg })

describe('ewmaTrend', () => {
  it('smooths toward new values', () => {
    const t = ewmaTrend([w('2026-06-01', 84), w('2026-06-02', 83)], 0.5)
    expect(t[0].trend).toBe(84)
    expect(t[1].trend).toBeCloseTo(83.5)
  })
})

describe('backCalcTdee', () => {
  it('computes TDEE from intake + trend delta', () => {
    // 21 days, avg 1600 kcal, trend fell 1.5kg → tdee ≈ 1600 + 1.5*7700/21 = 2150
    const r = backCalcTdee({ avgIntake: 1600, trendDeltaKg: -1.5, windowDays: 21, loggedDays: 18, weighIns: 8 })
    expect(r.tdee).toBe(2150)
    expect(r.reliable).toBe(true)
  })
  it('flags unreliable with sparse data', () => {
    const r = backCalcTdee({ avgIntake: 1600, trendDeltaKg: -0.5, windowDays: 21, loggedDays: 6, weighIns: 1 })
    expect(r.reliable).toBe(false)
  })
})

describe('goalEta', () => {
  it('projects a date when trending down', () => {
    const r = goalEta({ currentTrendKg: 80, goalKg: 72, ratePerWeekKg: -0.5, today: '2026-06-12' })
    expect(r.etaDate).toBe('2026-10-02') // 16 weeks out
  })
  it('returns null when flat or gaining', () => {
    expect(goalEta({ currentTrendKg: 80, goalKg: 72, ratePerWeekKg: 0.1, today: '2026-06-12' }).etaDate).toBeNull()
  })
})

describe('foodPatterns', () => {
  it('ranks top foods and budget-blowers', () => {
    const entries = [
      { date: '2026-06-01', name: 'Porridge', calories: 300 },
      { date: '2026-06-01', name: 'Beer', calories: 400 },
      { date: '2026-06-02', name: 'Porridge', calories: 300 },
      { date: '2026-06-03', name: 'Beer', calories: 400 },
      { date: '2026-06-04', name: 'Beer', calories: 400 },
    ]
    const overDates = new Set(['2026-06-01', '2026-06-03', '2026-06-04'])
    const p = foodPatterns(entries, overDates, 2)
    expect(p.topFoods[0]).toMatchObject({ name: 'Beer', count: 3 })
    expect(p.budgetBlowers[0].name).toBe('Beer') // present on 3/3 over days
  })
})
```

- [ ] **Step 2:** `npm test` — FAIL. Implement `lib/utils/analytics.ts`:

```ts
import { addDays } from './dates'

export function ewmaTrend(weights: { date: string; weight_kg: number }[], alpha = 0.2): { date: string; trend: number }[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const out: { date: string; trend: number }[] = []
  let prev: number | null = null
  for (const w of sorted) {
    prev = prev === null ? w.weight_kg : alpha * w.weight_kg + (1 - alpha) * prev
    out.push({ date: w.date, trend: Math.round(prev * 100) / 100 })
  }
  return out
}

const KCAL_PER_KG = 7700

export function backCalcTdee(p: { avgIntake: number; trendDeltaKg: number; windowDays: number; loggedDays: number; weighIns: number }) {
  const tdee = Math.round(p.avgIntake + (-p.trendDeltaKg * KCAL_PER_KG) / p.windowDays)
  const reliable = p.loggedDays >= 10 && p.weighIns >= 2 && p.windowDays >= 14
  return { tdee, reliable }
}

export function goalEta(p: { currentTrendKg: number; goalKg: number; ratePerWeekKg: number; today: string }) {
  const toLose = p.currentTrendKg - p.goalKg
  if (toLose <= 0) return { etaDate: p.today, weeks: 0 }
  if (p.ratePerWeekKg >= -0.05) return { etaDate: null, weeks: null } // flat or gaining
  const weeks = toLose / -p.ratePerWeekKg
  return { etaDate: addDays(p.today, Math.round(weeks * 7)), weeks: Math.round(weeks * 10) / 10 }
}

type PatternEntry = { date: string; name: string; calories: number }

export function foodPatterns(entries: PatternEntry[], overBudgetDates: Set<string>, minCount = 3) {
  const byName = new Map<string, { count: number; totalKcal: number; dates: Set<string> }>()
  for (const e of entries) {
    const key = e.name.trim()
    const rec = byName.get(key) ?? { count: 0, totalKcal: 0, dates: new Set<string>() }
    rec.count++; rec.totalKcal += e.calories; rec.dates.add(e.date)
    byName.set(key, rec)
  }
  const topFoods = [...byName.entries()]
    .map(([name, r]) => ({ name, count: r.count, avgKcal: Math.round(r.totalKcal / r.count) }))
    .sort((a, b) => b.count - a.count).slice(0, 10)
  const budgetBlowers = [...byName.entries()]
    .filter(([, r]) => r.count >= minCount)
    .map(([name, r]) => {
      const overDays = [...r.dates].filter(d => overBudgetDates.has(d)).length
      return { name, count: r.count, overRate: overDays / r.dates.size }
    })
    .filter(f => f.overRate >= 0.5)
    .sort((a, b) => b.overRate - a.overRate).slice(0, 5)
  return { topFoods, budgetBlowers }
}
```

- [ ] **Step 3:** `npm test` — PASS. Commit: `git commit -am "feat: analytics math — trend, TDEE back-calc, ETA, patterns"`

### Task 15: Analytics API

**Files:** Create `app/api/analytics/route.ts`

- [ ] **Step 1:** GET route (node runtime fine). Load profile, last 60 days of entries (`getFoodEntriesInRange`), weights (`getWeightHistory(60)`), activity (`getActivityRange(60)`). Compute and return one JSON payload:
  - `trend`: `ewmaTrend(weights)` plus the raw points
  - `tdee`: 21-day window — avg intake over days *with ≥1 entry*, trend delta from first/last trend value inside the window, `loggedDays`, `weighIns` → `backCalcTdee(...)`
  - `eta`: rate = (last trend − trend 14 days earlier) / 2 per week → `goalEta({ currentTrendKg, goalKg: GOAL_WEIGHT_KG, ratePerWeekKg, today: todayLondon() })` where `const GOAL_WEIGHT_KG = 72 // single-user app; profile has no goal-weight column` is declared at the top of the route
  - `compliance`: group last 28 days by `isoWeekKey` → per week `{ weekKey, daysLogged, onBudgetDays, proteinHitDays, avgIntake, avgBudget }` using per-day `getBudgetBreakdown` with that day's activity
  - `patterns`: `foodPatterns(entries, overBudgetDates)` where `overBudgetDates` = dates with eaten > that day's budget
  - `weekdayWeekend`: avg intake Mon–Fri vs Sat–Sun over the 60 days
- [ ] **Step 2:** `curl localhost:3000/api/analytics` while `npm run dev` with a logged-in session is impractical — instead verify via the browser devtools network tab on the Progress page in Task 16, or temporarily `console.log` server-side. Build must pass.
- [ ] **Step 3:** Commit: `git commit -am "feat: analytics API"`

### Task 16: Progress tab redesign

**Files:** Rewrite `app/(app)/progress/page.tsx` (frontend-design skill); Modify `components/WeeklySummaryCard.tsx`, `components/SummaryStrip.tsx`

- [ ] **Step 1:** Read the current page fully (430 lines — charts, table cards, CSV export). Preserve: CSV export, per-day history cards, existing chart data sources. Rebuild presentation in the language with this hierarchy:
  1. **Headline stats row**: `StatNumeral`s — REAL TDEE (from analytics; "—" + "needs more data" micro-label when `!reliable`), TREND WEIGHT (latest trend kg), GOAL ETA (date or "—").
  2. **Weight chart**: trend line in `--accent` (2px), raw weigh-ins as 3px `--ink-60` dots, goal line at 72 kg as a dashed hairline. Recharts, monochrome axes (`--muted`, 10px), no grid fills.
  3. **Compliance strip**: last 4 weeks, each a row — week label, days-logged dots, on-budget count, protein-floor hit count (`n/7` in `tnum`).
  4. **Calorie + macro charts**: keep existing data, restyle (accent line on ink axes; kill multi-color gradients).
  5. **Patterns section**: "MOST LOGGED" top-5 list (name · count · avg kcal), "BUDGET BLOWERS" list (name · over-rate as "3 of 4 days over"), "WEEKDAY VS WEEKEND" two `StatNumeral`s.
  6. Existing day-cards + CSV button restyled.
- [ ] **Step 2:** Every analytics figure must render a "needs more data" state when inputs are sparse — no NaN, no empty charts (test by viewing with the seed account if data is thin).
- [ ] **Step 3:** Browser-verify at 390×844. `npm run build`; commit: `git commit -am "feat: progress v2 — trend, TDEE, ETA, compliance, patterns"`

### Task 17: Weekly summary rebuilt

**Files:** Rewrite `app/api/weekly-summary/route.ts`

- [ ] **Step 1:** Rebuild on v2 primitives: previous ISO week range via `weekStart`/`addDays`; per-day budgets from `getBudgetBreakdown` with that day's activity (fixes the zero-activity undercount); weight change from `ewmaTrend` delta over the week (not raw weigh-ins); prompt tone changed to match the persona — direct, numeric, no cheerleading ("You logged 6/7 days and averaged a 480 kcal deficit…"). Use the Task 5 wrapper with fallback. Cache the result in `insights` (`type: 'weekly_review'... ` — no: weekly-summary card and Coach weekly review are distinct; keep this route uncached but cheap, it's user-initiated from the dashboard card). Check where `WeeklySummaryCard` calls it and ensure it's on-demand (button/expander), not auto-fired on every dashboard load — if it auto-fires, gate it behind a tap.
- [ ] **Step 2:** Verify in dev; `npm run build`; commit: `git commit -am "feat: weekly summary on v2 math + persona voice"`

---

## Batch 6 — Adaptive targets

### Task 18: Suggestion engine + card

**Files:** Create `lib/utils/adaptive.ts`, `lib/utils/adaptive.test.ts`, `app/api/adaptive-target/route.ts`; Modify `app/(app)/progress/page.tsx` (card at top)

- [ ] **Step 1:** Failing tests `lib/utils/adaptive.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { suggestTargetAdjustment } from './adaptive'

const base = { tdeeEstimate: 2200, reliable: true, currentBase: 1500, currentDeficit: 600, trendRatePerWeekKg: -0.3, targetRatePerWeekKg: -0.55 }

describe('suggestTargetAdjustment', () => {
  it('suggests a cut when losing slower than target', () => {
    const s = suggestTargetAdjustment(base)
    expect(s.suggest).toBe(true)
    expect(s.newBase).toBeLessThan(1500)
    expect(s.newBase).toBeGreaterThanOrEqual(1400)     // floor
    expect(1500 - s.newBase!).toBeLessThanOrEqual(250) // max step
  })
  it('stays quiet when on track', () => {
    expect(suggestTargetAdjustment({ ...base, trendRatePerWeekKg: -0.5 }).suggest).toBe(false)
  })
  it('stays quiet when unreliable', () => {
    expect(suggestTargetAdjustment({ ...base, reliable: false }).suggest).toBe(false)
  })
  it('never pushes deficit past 750', () => {
    const s = suggestTargetAdjustment({ ...base, tdeeEstimate: 2000, currentDeficit: 700 })
    if (s.suggest) expect(s.newDeficit!).toBeLessThanOrEqual(750)
  })
})
```

- [ ] **Step 2:** Implement `lib/utils/adaptive.ts`:

```ts
type Params = {
  tdeeEstimate: number; reliable: boolean
  currentBase: number; currentDeficit: number
  trendRatePerWeekKg: number; targetRatePerWeekKg: number // negative = losing
}
export type TargetSuggestion = { suggest: boolean; newBase?: number; newDeficit?: number; reason?: string }

export function suggestTargetAdjustment(p: Params): TargetSuggestion {
  if (!p.reliable) return { suggest: false }
  const gap = p.trendRatePerWeekKg - p.targetRatePerWeekKg // >0 = losing too slowly
  if (Math.abs(gap) <= 0.15) return { suggest: false }
  const kcalAdjust = Math.round((gap * 7700) / 7 / 10) * 10 // weekly gap → daily kcal, 10s
  const clamped = Math.max(-250, Math.min(250, kcalAdjust))
  let newBase = p.currentBase - clamped
  newBase = Math.max(1400, newBase)
  const newDeficit = Math.min(750, p.currentDeficit + (p.currentBase - newBase))
  if (newBase === p.currentBase) return { suggest: false }
  return {
    suggest: true, newBase, newDeficit,
    reason: gap > 0
      ? `Losing ${Math.abs(p.trendRatePerWeekKg).toFixed(2)} kg/wk vs ${Math.abs(p.targetRatePerWeekKg).toFixed(2)} target — tighten by ${p.currentBase - newBase} kcal.`
      : `Losing faster than target — ease up by ${newBase - p.currentBase} kcal.`,
  }
}
```

- [ ] **Step 3:** `npm test` — PASS. `app/api/adaptive-target/route.ts`: GET computes the suggestion (reuse analytics internals; target rate −0.55 kg/wk) and checks `insights` for an existing `target_suggestion` row this ISO week (dismissed or applied → return `{ suggest: false }`). POST with `{ action: 'apply' | 'dismiss' }`: apply → `updateProfileFields({ deficit_amount: newDeficit, target_calories: newBase })` and record in `insights`; dismiss → record only. (Write `getInsight`/`upsertInsight` helpers in `lib/db/queries.ts` keyed by `(type, period_key)`.)
- [ ] **Step 4:** Card UI at the top of Progress (and shown until acted on): `HairlineCard` with accent left rule — micro-label "ADAPTIVE TARGET", the reason sentence, two buttons: "Apply −150" (accent fill) / "Dismiss" (hairline). One tap each, optimistic, haptic.
- [ ] **Step 5:** Browser-verify (with thin data the card should simply not appear). `npm run build`; commit: `git commit -am "feat: adaptive target suggestions"`

---

## Batch 7 — Coach + Settings

### Task 19: Coach digest, streaming, weekly review

**Files:** Create `lib/ai/digest.ts`; Rewrite `app/api/coach/route.ts`; Create `app/api/weekly-review/route.ts`; Redesign `app/(app)/coach/page.tsx` (frontend-design skill)

- [ ] **Step 1:** `lib/ai/digest.ts` — `buildCoachDigest(): Promise<string>`: load profile + 28 days entries/activity/weights, compute via existing helpers (`getBudgetBreakdown`, `ewmaTrend`, `backCalcTdee`, `computeWeekBank`) and return a compact plain-text block (~15 lines, no raw item dumps):

```
PROFILE: 83.0kg (trend 82.4kg, −0.41kg/wk), goal 72kg, base target 1500 kcal, protein floor 130g
TDEE: estimated 2210 kcal from last 21d (reliable)
LAST 28D: logged 25/28 days · avg intake 1612 kcal · avg deficit 540 · protein floor hit 21/25
THIS WEEK: bank −120 kcal · 2 workout days
LAST 7 DAYS: Mon 1480/1500 ✓ · Tue 1720/1680 ✗ · ...
```

- [ ] **Step 2:** Rewrite `app/api/coach/route.ts`: `export const runtime = 'edge'`; build the model with `makeModel(PRIMARY_MODEL, { temperature: 0.5, systemInstruction })` — **systemInstruction goes on `getGenerativeModel`, NOT `startChat`** (the current code passes it to `startChat` where it may be ignored — this is the bug fix). System prompt = persona block (same voice as dispatcher) + digest + "Answer concisely, cite their numbers, never log or modify data." Use `chat.sendMessageStream(message)` and return a streaming `text/plain` response:

```ts
const result = await chat.sendMessageStream(message)
const encoder = new TextEncoder()
const stream = new ReadableStream({
  async start(controller) {
    try {
      for await (const chunk of result.stream) controller.enqueue(encoder.encode(chunk.text()))
    } catch (e) { controller.enqueue(encoder.encode('\n[connection lost — tap retry]')) }
    controller.close()
  },
})
return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
```

Capacity errors before streaming starts → JSON `{error}` with 429/503 like chat (client distinguishes by Content-Type).

- [ ] **Step 3:** `app/api/weekly-review/route.ts`: GET returns the cached `insights` row (`type 'weekly_review'`, current ISO week) or `{ exists: false }`; POST generates one Gemini call (non-streaming, JSON schema `{ wins: string[], concerns: string[], focus: string }`) from the digest, upserts into `insights`, returns it. NO auto-generation.
- [ ] **Step 4:** Redesign the Coach page (frontend-design skill): same conversation behavior + localStorage history, restyled like the chat tab; client reads the streaming body via `res.body.getReader()` appending text progressively; **Weekly review panel** at top — if cached review exists show it (WINS / WATCH / FOCUS sections with micro-labels), else a "Generate weekly review" hairline button (one tap, one call, then cached); starter chips restyled.
- [ ] **Step 5:** Verify streaming visibly types in dev; weekly review generates once then loads from DB on reload (check the network tab — second load must be GET-only). `npm run build`; commit: `git commit -am "feat: coach v2 — digest, true streaming, systemInstruction fix, DB-cached weekly review"`

### Task 20: Settings redesign + budget knobs

**Files:** Redesign `app/(app)/settings/page.tsx` (frontend-design skill); Modify `app/api/profile/route.ts` if it whitelists fields

- [ ] **Step 1:** Read both files. Add a "BUDGET MODEL" section: steppers/inputs for `baseline_steps` (0–10,000, step 500) and `earn_back_rate` (50–100%, step 5) with one-line explanations ("Steps below this are already in your TDEE", "Fraction of activity calories added back to your budget"). Ensure the profile API accepts the two new fields (add to its allowed fields if whitelisted, and to `ProfileUpdateFields` in `lib/db/types.ts`).
- [ ] **Step 2:** Restyle the whole page to the language (hairline sections, micro-labels, accent primary actions). Keep all existing functionality (profile edit, macro targets editor, sign out, CSV export if present).
- [ ] **Step 3:** Verify a knob change immediately alters the dashboard budget (cache invalidated on save: `appCache.invalidatePrefix('/api')`). `npm run build`; commit: `git commit -am "feat: settings v2 + budget model knobs"`

---

## Batch 8 — Apple Health sync

### Task 21: health-sync endpoint

**Files:** Create `app/api/health-sync/route.ts`, `lib/supabase/admin.ts`; Modify `.env.local` (user adds keys), `CLAUDE.md` env docs

- [ ] **Step 1:** `lib/supabase/admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only; bypasses RLS
    { auth: { persistSession: false } }
  )
}
```

- [ ] **Step 2:** `app/api/health-sync/route.ts` (node runtime — needs `crypto.timingSafeEqual`):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { stepsToCalories } from '@/lib/utils/calories'
import { todayLondon } from '@/lib/utils/dates'

function authorized(req: NextRequest): boolean {
  const secret = process.env.HEALTH_SYNC_SECRET
  const header = req.headers.get('authorization') ?? ''
  if (!secret || !header.startsWith('Bearer ')) return false
  const token = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return token.length === expected.length && timingSafeEqual(token, expected)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayLondon()
  const steps = Number.isFinite(+body.steps) ? Math.round(+body.steps) : null
  const activeEnergy = Number.isFinite(+body.active_energy_kcal) ? Math.round(+body.active_energy_kcal) : null
  const weightKg = Number.isFinite(+body.weight_kg) && +body.weight_kg > 30 && +body.weight_kg < 250 ? +body.weight_kg : null

  const admin = createAdminClient()
  const { data: profile } = await admin.from('user_profiles').select('user_id, weight_kg').limit(1).single()
  if (!profile) return NextResponse.json({ error: 'no profile' }, { status: 500 })

  const updates: Record<string, unknown> = {}
  if (steps !== null) {
    updates.steps_count = steps
    updates.steps_calories = stepsToCalories(steps, profile.weight_kg)
  }
  if (activeEnergy !== null) {
    const grossStepsKcal = steps !== null ? stepsToCalories(steps, profile.weight_kg) : 0
    updates.workout_calories = Math.max(0, activeEnergy - grossStepsKcal) // avoid double-counting steps
  }
  if (Object.keys(updates).length > 0) {
    await admin.from('daily_activity').upsert(
      { user_id: profile.user_id, date, ...updates },
      { onConflict: 'user_id,date' }
    )
  }
  if (weightKg !== null) {
    const { data: existing } = await admin.from('weight_entries')
      .select('id').eq('user_id', profile.user_id).eq('date', date).maybeSingle()
    if (existing) await admin.from('weight_entries').update({ weight_kg: weightKg }).eq('id', existing.id)
    else await admin.from('weight_entries').insert({ user_id: profile.user_id, date, weight_kg: weightKg })
  }
  return NextResponse.json({ ok: true, date, applied: { steps, activeEnergy, weightKg } })
}
```

Check `001_initial.sql` for daily_activity's unique constraint name/columns — adjust `onConflict` to match (it must have one for date+user; if the upsert helper in `lib/db/queries.ts:67` uses a different conflict target, mirror that).

- [ ] **Step 3:** User action (STOP and ask): add `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Settings → API) and a generated `HEALTH_SYNC_SECRET` (`openssl rand -hex 24`) to `.env.local` and to Vercel env vars.
- [ ] **Step 4:** Test locally:

```bash
curl -s -X POST localhost:3000/api/health-sync -H "Authorization: Bearer $HEALTH_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"steps": 9500, "active_energy_kcal": 520, "weight_kg": 82.6}'
# expect {"ok":true,...}; wrong token → 401
```

Verify dashboard shows the steps/workout and the weight appears in Progress.

- [ ] **Step 5:** Commit: `git commit -am "feat: Apple Health sync endpoint"`

### Task 22: Shortcut recipe + docs

**Files:** Create `docs/health-sync-shortcut.md`; Modify `CLAUDE.md`

- [ ] **Step 1:** Write `docs/health-sync-shortcut.md` — a complete, step-by-step iOS Shortcuts recipe:
  1. Shortcuts app → + → name "Sync Health".
  2. Add **Find Health Samples** → type Steps, today, Group By: none → **Calculate Statistics** (Sum) → save to variable `Steps`.
  3. Repeat for Active Energy (Sum, kcal) → `Energy`; Weight (Most Recent) → `Weight`.
  4. Add **Dictionary**: `steps = Steps`, `active_energy_kcal = Energy`, `weight_kg = Weight` (numbers).
  5. Add **Get Contents of URL**: `https://<your-vercel-url>/api/health-sync`, Method POST, Headers `Authorization: Bearer <HEALTH_SYNC_SECRET>`, Request Body: JSON ← Dictionary.
  6. Automation: Shortcuts → Automation → + → Time of Day 21:30 daily → Run Immediately → select "Sync Health".
  7. Note: first run prompts for Health read permissions — allow Steps, Active Energy, Weight; chat screenshots remain the fallback for individual workouts.
- [ ] **Step 2:** Update `CLAUDE.md`: budget formula section → v2 formula with baseline/earn-back; tables list (6 + insights); model name `gemini-3.5-flash`; new env vars (`SUPABASE_SERVICE_ROLE_KEY`, `HEALTH_SYNC_SECRET`, optional `GEMINI_FALLBACK_MODEL`); new routes (`analytics`, `week`, `adaptive-target`, `weekly-review`, `health-sync`); design language one-liner; removed `coaching-nudge`.
- [ ] **Step 3:** Final sweep: `npm test && npm run build` — all green. Browser-verify all five tabs at 390×844 one last time.
- [ ] **Step 4:** Commit: `git commit -am "docs: health-sync shortcut recipe + CLAUDE.md v2"`
