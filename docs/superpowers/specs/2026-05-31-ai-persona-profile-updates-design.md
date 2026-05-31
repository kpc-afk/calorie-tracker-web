# AI Persona, Profile Updates via Chat, and Profile Seed

**Date:** 2026-05-31  
**Status:** Approved

## Overview

Four changes to the calorie tracker:

1. Upgrade AI model to Gemini 2.5 Pro
2. Inject a hardcoded behavioral persona into the chat system prompt
3. Add a `profile_update_pending` intent so the AI can propose profile changes (goal, weight, deficit, macros) with a confirm/cancel UI before writing to the database
4. Pre-seed the user profile in Supabase so onboarding is skipped on first load

---

## 1. Model Upgrade

Swap `gemini-2.5-flash` → `gemini-2.5-pro` in:

- `lib/ai/gemini.ts` — both `flashModel` and `flashModelText` instances
- `lib/ai/chat-dispatcher.ts` — the inline `getGenerativeModel` call at line 73

No SDK changes required. The `@google/generative-ai` SDK (`^0.24.1`) supports this model string.

---

## 2. Behavioral Persona (Hardcoded in `chat-dispatcher.ts`)

Prepend a static persona block to the existing system prompt. The dynamic context (budget, eaten, remaining, macro targets, weight) is already injected — the persona carries only behavioral rules and fixed targets.

Persona content:

```
PERSONA & BEHAVIOR:
Act as a direct, honest, data-driven nutrition and fitness advisor. Do not sugar-coat advice or act as a cheerleader. Give straight facts and raw numbers. Correct strategy when the user is acting out of panic rather than logic. All measurements must strictly be in metric (kg, km, ml, °C) — never Fahrenheit or Imperial.

DAILY INTAKE TARGETS:
- Rest days (desk/study/low steps): 1,400–1,500 kcal intake
- Workout days (10k steps + intense Stairmaster/Cycling): 1,600–1,700 kcal intake
- Protein floor: 130g every single day — strictly required to protect muscle mass. Always prioritise hitting this before worrying about the calorie ceiling.

STRATEGY RULES:
- Target deficit: 500–700 kcal/day. Never encourage 1,000+ kcal deficits.
- Weekly average over daily perfection. Minor daily overages are not emergencies; do not treat them as crises.
- No guilt workouts. If the user is mentally exhausted, recommend sleep over late-night cardio. Workouts are for cardiovascular health and endurance, not to "pay" for food.
- Muscle over scale weight. The goal is to arrive at 72kg lean, not depleted.

LIFESTYLE CONTEXT:
MBA student in London. Intense mental load (hackathons, studying). Active cyclist. Late-night workouts.
```

This block is placed before the dynamic user profile context already in the prompt.

---

## 3. Profile Update Intent with Confirmation UI

### New type

Add to `lib/db/types.ts`:

```ts
type ProfileUpdateFields = {
  goal?: 'lose' | 'maintain' | 'gain'
  deficit_amount?: number
  weight_kg?: number
  protein_target_g?: number
  carbs_target_g?: number
  fat_target_g?: number
  target_calories?: number
}

// Added to ChatResponse union:
| { intent: 'profile_update_pending'; updates: ProfileUpdateFields; message: string }
```

### System prompt addition

A 5th intent shape is added to the Gemini system prompt in `chat-dispatcher.ts`:

```
5. Profile update (user requests a change to their goal, weight, deficit, or macro targets):
{"intent":"profile_update_pending","updates":{"goal":"maintain","deficit_amount":0,"target_calories":1755},"message":"I'll set your goal → Maintain and drop your deficit to 0. New daily base budget: 1,755 kcal. Confirm?"}

Rules for profile_update_pending:
- Only include fields that are actually changing
- When switching goal to "maintain": set deficit_amount to 0 and target_calories to the user's BMR
- When switching goal to "lose": suggest a deficit_amount of 300–400 kcal
- Always state the proposed change clearly in the message and end with "Confirm?"
```

### Chat API route (`app/api/chat/route.ts`)

No changes — the profile write happens client-side on confirmation, not server-side.

### Chat UI

When the chat response has `intent === 'profile_update_pending'`:

- `components/ChatMessage.tsx` renders the AI message + **Confirm** / **Cancel** buttons (same visual style as food card action buttons). It receives a new `onProfileUpdated` callback prop to call on confirm.
- `app/(app)/chat/page.tsx` handles `onProfileUpdated`: calls `POST /api/profile` with `{ ...profile, ...updates }`, then calls `loadContext()` to refresh profile state. On cancel, appends a plain `assistant` message: "Okay, no changes made."
- Only one `profile_update_pending` card can be active at a time; sending a new message clears any pending state.

---

## 4. Profile Seed (Skip Onboarding)

Insert the user's profile directly into Supabase so the app never redirects to onboarding. This is a one-time operation run at implementation time using the Supabase dashboard or a seed script.

Seed values:

| Field | Value |
|---|---|
| date_of_birth | 1994-12-14 |
| sex | male |
| height_cm | 172 |
| weight_kg | 83 |
| goal | lose |
| bmr | 1755 |
| deficit_amount | 305 |
| target_calories | 1450 |
| protein_target_g | 130 |
| carbs_target_g | 120 |
| fat_target_g | 50 |

`deficit_amount = 305` gives a rest-day base budget of 1,755 − 305 = 1,450 kcal. Steps and workout calories are added dynamically on top for active days, pushing the budget toward the 1,600–1,700 workout-day target.

The seed is applied by calling `POST /api/profile` while authenticated in the browser (or via a one-time `fetch` call in the browser console). This calls the existing `upsertProfile` server function, which writes using the authenticated user's Supabase ID. No schema changes required.

---

## Files Changed

| File | Change |
|---|---|
| `lib/ai/gemini.ts` | Swap model string to `gemini-2.5-pro` |
| `lib/ai/chat-dispatcher.ts` | Swap model string; prepend persona block; add 5th intent to prompt |
| `lib/db/types.ts` | Add `ProfileUpdateFields` type and `profile_update_pending` to `ChatResponse` union |
| `components/ChatMessage.tsx` | Handle `profile_update_pending` render; add `onProfileUpdated` prop |
| `app/(app)/chat/page.tsx` | Pass `onProfileUpdated` handler; call profile API on confirm; refresh state |
| Supabase (one-time) | Seed user profile row |

---

## Out of Scope

- Storing persona text in the database (hardcoded for this personal app)
- Multi-user support or per-user persona customisation
- Onboarding UI changes (seed bypasses it entirely)
