# AI Persona, Profile Updates via Chat, and Profile Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade to Gemini 2.5 Pro, inject a hardcoded behavioral persona into the chat system prompt, add a profile_update_pending intent with confirm/cancel UI, and seed the user profile to skip onboarding.

**Architecture:** All AI changes are in `lib/ai/` (model strings + system prompt). New type variant `profile_update_pending` flows from `lib/db/types.ts` → `chat-dispatcher.ts` system prompt → `ChatMessage.tsx` UI → `chat/page.tsx` handler. No new files needed; no API route changes needed (profile seed uses the existing POST /api/profile endpoint).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Google Generative AI SDK (`@google/generative-ai`), Supabase.

---

## File Map

| File | What changes |
|---|---|
| `lib/db/types.ts` | Add `ProfileUpdateFields` type; add `profile_update_pending` to `ChatResponse` union |
| `lib/ai/gemini.ts` | Swap model string `gemini-2.5-flash` → `gemini-2.5-pro` (both instances) |
| `lib/ai/chat-dispatcher.ts` | Swap model string; prepend persona block; add 5th intent shape to system prompt |
| `components/ChatMessage.tsx` | Import `ProfileUpdateFields`; add `onProfileUpdated` + `onProfileUpdateCancelled` props; render confirm/cancel UI for `profile_update_pending` |
| `app/(app)/chat/page.tsx` | Import `ProfileUpdateFields`; add `handleProfileUpdated` + `handleProfileUpdateCancelled`; pass to `ChatMessage` |

---

## Task 1: Add types

**Files:**
- Modify: `lib/db/types.ts`

- [ ] **Step 1: Add `ProfileUpdateFields` type and extend `ChatResponse`**

Open `lib/db/types.ts`. Add the new type before the `ChatResponse` definition, then append the new variant to the union:

```ts
export type ProfileUpdateFields = {
  goal?: 'lose' | 'maintain' | 'gain'
  deficit_amount?: number
  weight_kg?: number
  protein_target_g?: number
  carbs_target_g?: number
  fat_target_g?: number
  target_calories?: number
}

export type ChatResponse =
  | { intent: 'food_log'; items: NutritionResult[]; message: string }
  | { intent: 'workout'; activeCalories: number; message: string }
  | { intent: 'steps'; steps: number; stepsCalories: number; message: string }
  | { intent: 'question'; message: string }
  | { intent: 'profile_update_pending'; updates: ProfileUpdateFields; message: string }
```

- [ ] **Step 2: Verify types compile**

```bash
cd "/Users/kyle-LBS/Documents/Claude Code Projects/Calorie Tracker Web"
npx tsc --noEmit
```

Expected: no errors (only `lib/db/types.ts` changed, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add lib/db/types.ts
git commit -m "feat: add ProfileUpdateFields type and profile_update_pending to ChatResponse"
```

---

## Task 2: Upgrade model and rewrite system prompt

**Files:**
- Modify: `lib/ai/gemini.ts`
- Modify: `lib/ai/chat-dispatcher.ts`

- [ ] **Step 1: Swap model string in `lib/ai/gemini.ts`**

Replace both occurrences of `'gemini-2.5-flash'` with `'gemini-2.5-pro'`. The full file after the change:

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const flashModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
})

export const flashModelText = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig: { temperature: 0.5 },
})

export function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${cleaned.slice(0, 100)}`)
  }
}
```

- [ ] **Step 2: Rewrite `dispatchChat` in `lib/ai/chat-dispatcher.ts`**

Replace the entire file with the version below. Changes: model string swapped; persona block prepended to `systemPrompt`; 5th intent added; inline model instantiation updated.

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { parseJSON } from './gemini'
import type { ChatResponse, UserProfile } from '@/lib/db/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

type DailyContext = {
  caloriesEaten: number
  proteinEaten: number
  carbsEaten: number
  fatEaten: number
  stepsCalories: number
  workoutCalories: number
}

const PERSONA = `PERSONA & BEHAVIOR:
Act as a direct, honest, data-driven nutrition and fitness advisor. Do not sugar-coat advice or act as a cheerleader. Give straight facts and raw numbers. Correct strategy when the user is acting out of panic rather than logic. All measurements must strictly be in metric (kg, km, ml, °C) — never Fahrenheit or Imperial.

DAILY INTAKE TARGETS:
- Rest days (desk/study/low steps): 1,400–1,500 kcal intake
- Workout days (10k steps + intense Stairmaster/Cycling): 1,600–1,700 kcal intake
- Protein floor: 130g every single day — strictly required to protect muscle mass. Always prioritise hitting this before worrying about the calorie ceiling.

STRATEGY RULES:
- Target deficit: 500–700 kcal/day. Never encourage 1,000+ kcal deficits.
- Weekly average over daily perfection. Minor daily overages are not emergencies.
- No guilt workouts. If mentally exhausted, recommend sleep over late-night cardio. Workouts are for cardiovascular health and endurance, not to pay for food.
- Muscle over scale weight. The goal is to arrive at 72kg lean, not depleted.

LIFESTYLE CONTEXT:
MBA student in London. Intense mental load (hackathons, studying). Active cyclist. Late-night workouts.

---`

export async function dispatchChat(params: {
  message: string
  imageBase64Array?: string[]
  imageMimeTypes?: string[]
  profile: UserProfile
  todayContext: DailyContext
  history: { role: 'user' | 'assistant'; content: string }[]
  today: string
}): Promise<ChatResponse> {
  const { message, imageBase64Array, imageMimeTypes, profile, todayContext } = params

  const budget = profile.bmr - profile.deficit_amount + todayContext.stepsCalories + todayContext.workoutCalories
  const remaining = budget - todayContext.caloriesEaten

  const systemPrompt = `${PERSONA}

You are a personal nutrition assistant embedded in a calorie tracking app.

User profile:
- Goal: ${profile.goal}
- BMR: ${profile.bmr} kcal
- Daily deficit target: ${profile.deficit_amount} kcal
- Today's budget: ${budget} kcal
- Eaten so far: ${todayContext.caloriesEaten} kcal (P:${todayContext.proteinEaten}g C:${todayContext.carbsEaten}g F:${todayContext.fatEaten}g)
- Remaining: ${remaining} kcal
- Targets: Protein ${profile.protein_target_g}g, Carbs ${profile.carbs_target_g}g, Fat ${profile.fat_target_g}g
- User weight: ${profile.weight_kg} kg (used for step calorie calculations)

Detect intent and respond with JSON in EXACTLY one of these shapes:

1. Food logging (text description of food, or image of food):
{"intent":"food_log","items":[{"name":"...","brand":"","serving_size":"...","serving_unit":"...","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0,"saturated_fat":0,"cholesterol":0,"commentary":"1-2 sentence plain English explanation of the estimate for fact-checking, e.g. standard portion size, typical calorie range, macros breakdown"}],"message":"brief acknowledgement"}

2. Workout logging (text description of workout, or Apple Health/fitness screenshot):
{"intent":"workout","activeCalories":0,"message":"brief confirmation with details"}

3. Steps update (user says how many steps they did today):
{"intent":"steps","steps":0,"stepsCalories":0,"message":"brief confirmation with kcal added to budget"}
Note: stepsCalories = steps × 0.000571 × ${profile.weight_kg}

4. General question (nutrition advice, progress query, anything else):
{"intent":"question","message":"your answer as plain conversational text"}

5. Profile update (user wants to change their goal, weight, deficit, or macro targets):
{"intent":"profile_update_pending","updates":{"goal":"maintain","deficit_amount":0,"target_calories":${profile.bmr}},"message":"I'll set your goal → Maintain and drop your deficit to 0. New daily base budget: ${profile.bmr} kcal. Confirm?"}

Rules for profile_update_pending:
- Only include fields in "updates" that are actually changing
- When switching goal to "maintain": set deficit_amount to 0, target_calories to ${profile.bmr}
- When switching goal to "lose": suggest deficit_amount of 300–400 kcal, target_calories = BMR minus that amount
- When user reports a new weight: include weight_kg in updates
- State proposed changes clearly in the message and end with "Confirm?"

Important rules:
- Always include commentary on food items explaining the estimate basis
- For workout screenshots, read the active calories burned from the screen
- For steps, calculate stepsCalories = steps × 0.000571 × ${profile.weight_kg}
- Keep message fields brief and direct (no cheerleading)
- If unclear whether something is food or a question, lean toward food_log`

  const historyText = params.history
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const fullPrompt = historyText
    ? `${systemPrompt}\n\nRecent conversation:\n${historyText}\n\nUser: ${message}`
    : `${systemPrompt}\n\nUser: ${message}`

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })

  type Part = string | { inlineData: { data: string; mimeType: string } }
  const parts: Part[] = [fullPrompt]

  if (imageBase64Array && imageBase64Array.length > 0) {
    imageBase64Array.forEach((b64, i) => {
      parts.push({
        inlineData: {
          data: b64,
          mimeType: imageMimeTypes?.[i] ?? 'image/jpeg',
        },
      })
    })
  }

  const result = await model.generateContent(parts as Parameters<typeof model.generateContent>[0])
  return parseJSON<ChatResponse>(result.response.text())
}
```

- [ ] **Step 3: Type-check**

```bash
cd "/Users/kyle-LBS/Documents/Claude Code Projects/Calorie Tracker Web"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke-test in browser**

```bash
npm run dev
```

Open `http://localhost:3000/chat`. Send: `"I had a chicken breast for lunch"`. Verify the response is direct in tone (no "Great job!" cheerleading) and returns food items as before.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/gemini.ts lib/ai/chat-dispatcher.ts
git commit -m "feat: upgrade to gemini-2.5-pro and add behavioral persona to system prompt"
```

---

## Task 3: Add profile_update_pending UI to ChatMessage

**Files:**
- Modify: `components/ChatMessage.tsx`

- [ ] **Step 1: Add import and new props**

In `components/ChatMessage.tsx`, update the import at line 6 and the `Props` type:

```ts
import type { ChatResponse, NutritionResult, ProfileUpdateFields } from '@/lib/db/types'
```

Replace the `Props` type:

```ts
type Props = {
  message: Message
  onFoodAdded: (items: NutritionResult[], date: string) => void
  onWorkoutAdded: (kcal: number, date: string) => void
  onStepsAdded: (steps: number, kcal: number, date: string) => void
  onProfileUpdated: (updates: ProfileUpdateFields) => void
  onProfileUpdateCancelled: () => void
}
```

Update the destructure in the function signature:

```ts
export default function ChatMessage({ message, onFoodAdded, onWorkoutAdded, onStepsAdded, onProfileUpdated, onProfileUpdateCancelled }: Props) {
```

- [ ] **Step 2: Add `profile_update_pending` render branch**

Add this block immediately before the final `return null` at the bottom of the component (after the `steps` branch):

```tsx
  if (response.intent === 'profile_update_pending') return (
    <div className="space-y-2">
      <div className="flex justify-start">
        <div className="bg-zinc-800 text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
          {response.message}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onProfileUpdated(response.updates)}
          className="flex-1 bg-green-500 text-black font-semibold py-3 rounded-xl text-sm">
          Confirm
        </button>
        <button
          onClick={onProfileUpdateCancelled}
          className="flex-1 bg-zinc-700 text-gray-200 font-semibold py-3 rounded-xl text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
```

- [ ] **Step 3: Type-check**

```bash
cd "/Users/kyle-LBS/Documents/Claude Code Projects/Calorie Tracker Web"
npx tsc --noEmit
```

Expected: errors on `ChatMessage` usages in `chat/page.tsx` — missing the two new required props. This is expected and will be fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add components/ChatMessage.tsx
git commit -m "feat: render profile_update_pending intent with confirm/cancel buttons"
```

---

## Task 4: Wire up profile update handlers in chat page

**Files:**
- Modify: `app/(app)/chat/page.tsx`

- [ ] **Step 1: Update import to include `ProfileUpdateFields`**

On line 9 of `app/(app)/chat/page.tsx`, update the type import:

```ts
import type { NutritionResult, UserProfile, DailyActivity, FoodEntry, ProfileUpdateFields } from '@/lib/db/types'
```

- [ ] **Step 2: Add the two handler functions**

Add these two functions after `handleStepsAdded` (around line 148), before the `if (!profileChecked)` guard:

```ts
  async function handleProfileUpdated(updates: ProfileUpdateFields) {
    if (!profile) return
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, ...updates }),
    })
    await loadContext()
    setMessages(prev => [...prev, { type: 'assistant', content: 'Done. Your profile has been updated.' }])
  }

  function handleProfileUpdateCancelled() {
    setMessages(prev => [...prev, { type: 'assistant', content: 'Okay, no changes made.' }])
  }
```

- [ ] **Step 3: Pass new props to `ChatMessage`**

Update the `ChatMessage` usage in the JSX (around line 161–164):

```tsx
          <ChatMessage key={i} message={m}
            onFoodAdded={handleFoodAdded}
            onWorkoutAdded={handleWorkoutAdded}
            onStepsAdded={handleStepsAdded}
            onProfileUpdated={handleProfileUpdated}
            onProfileUpdateCancelled={handleProfileUpdateCancelled} />
```

- [ ] **Step 4: Type-check**

```bash
cd "/Users/kyle-LBS/Documents/Claude Code Projects/Calorie Tracker Web"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Test the full flow in browser**

```bash
npm run dev
```

Open `http://localhost:3000/chat`. Send: `"I've hit my goal weight, switch me to maintenance"`.

Expected:
- AI responds with a `profile_update_pending` card showing the proposed changes and "Confirm?" in the message
- **Confirm** and **Cancel** buttons appear below the message
- Click **Confirm** → profile updates, chat shows "Done. Your profile has been updated."
- Reload page — budget strip reflects the new maintenance budget (BMR with no deficit)
- Click **Cancel** on a new attempt → chat shows "Okay, no changes made.", no profile change

Also test a macro update: `"Bump my protein target to 150g"`. Expected: `profile_update_pending` with `updates: { protein_target_g: 150 }`.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/chat/page.tsx
git commit -m "feat: handle profile_update_pending confirm/cancel in chat page"
```

---

## Task 5: Seed user profile

This step runs once while the dev server is running and you are logged in. It pre-populates your profile so the app never redirects to onboarding.

- [ ] **Step 1: Open browser console at `http://localhost:3000`**

You must be logged in (the session cookie must be present for the API to authenticate).

- [ ] **Step 2: Run the seed fetch in the browser console**

```js
await fetch('/api/profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date_of_birth: '1994-12-14',
    sex: 'male',
    height_cm: 172,
    height_unit: 'cm',
    weight_kg: 83,
    weight_unit: 'kg',
    goal: 'lose',
    bmr: 1755,
    deficit_amount: 305,
    target_calories: 1450,
    protein_target_g: 130,
    carbs_target_g: 120,
    fat_target_g: 50,
  }),
}).then(r => r.json())
```

Expected response: `{ ok: true }`

- [ ] **Step 3: Verify onboarding is skipped**

Sign out, sign back in. The app should land on `/chat` directly without redirecting to `/onboarding`.

- [ ] **Step 4: Verify budget math in the summary strip**

With no steps or workout logged: budget should show **1,450 kcal** (1,755 BMR − 305 deficit).

---

## Verification Checklist

After all tasks are complete:

- [ ] Chat responds in direct tone — no cheerleading, no "Great job!"
- [ ] Asking "am I on track today?" returns calorie and macro context from the persona
- [ ] "Switch me to maintenance" → profile_update_pending card with Confirm/Cancel
- [ ] Confirming the update → profile changes, budget strip updates on reload
- [ ] Cancelling → no change, "Okay, no changes made." message
- [ ] Updating weight via chat (e.g. "I weighed in at 81kg") → profile_update_pending with `weight_kg: 81`
- [ ] Food logging still works correctly
- [ ] Steps and workout logging still work correctly
- [ ] No TypeScript errors: `npx tsc --noEmit` passes clean
