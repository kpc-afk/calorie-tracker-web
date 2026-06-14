import { SchemaType } from '@google/generative-ai'
import { makeModel, PRIMARY_MODEL, FALLBACK_MODEL } from './gemini'
import { generateWithRetry, type AIErrorKind } from './client'
import { getBudgetBreakdown, stepsToCalories, type BudgetBreakdown } from '@/lib/utils/calories'
import type { ChatResponse, NutritionResult, ProfileUpdateFields, UserProfile } from '@/lib/db/types'

type DailyContext = {
  caloriesEaten: number
  proteinEaten: number
  carbsEaten: number
  fatEaten: number
  stepsCount: number
  workoutCalories: number
}

type SessionItem = { name: string; calories: number; protein: number; carbs: number; fat: number }

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

type FlatFoodItem = {
  name: string
  brand?: string
  serving_size: string
  serving_unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  sodium?: number
  saturated_fat?: number
  cholesterol?: number
  commentary: string
}

type FlatChatResponse = {
  intent: 'food_log' | 'workout' | 'steps' | 'question' | 'profile_update_pending'
  message: string
  items?: FlatFoodItem[]
  activeCalories?: number
  steps?: number
  updates?: Record<string, unknown>
}

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

function toChatResponse(flat: FlatChatResponse, profile: UserProfile): ChatResponse {
  switch (flat.intent) {
    case 'food_log': {
      const items: NutritionResult[] = (flat.items ?? []).map(item => ({
        name: item.name,
        brand: item.brand,
        serving_size: item.serving_size,
        serving_unit: item.serving_unit,
        calories: item.calories ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
        fiber: item.fiber ?? 0,
        sugar: item.sugar ?? 0,
        sodium: item.sodium ?? 0,
        saturated_fat: item.saturated_fat ?? 0,
        cholesterol: item.cholesterol ?? 0,
        commentary: item.commentary ?? '',
      }))
      return { intent: 'food_log', items, message: flat.message }
    }
    case 'workout':
      return { intent: 'workout', activeCalories: flat.activeCalories ?? 0, message: flat.message }
    case 'steps': {
      const steps = Math.round(flat.steps ?? 0)
      return { intent: 'steps', steps, stepsCalories: stepsToCalories(steps, profile.weight_kg), message: flat.message }
    }
    case 'profile_update_pending':
      return { intent: 'profile_update_pending', updates: (flat.updates ?? {}) as ProfileUpdateFields, message: flat.message }
    case 'question':
    default:
      return { intent: 'question', message: flat.message }
  }
}

export async function dispatchChat(params: {
  message: string
  imageBase64Array?: string[]
  imageMimeTypes?: string[]
  profile: UserProfile
  todayContext: DailyContext
  history: { role: 'user' | 'assistant'; content: string }[]
  today: string
  sessionItems?: SessionItem[]
}): Promise<ChatResponse | { aiError: AIErrorKind }> {
  const { message, imageBase64Array, imageMimeTypes, profile, todayContext, today, sessionItems } = params

  const breakdown = getBudgetBreakdown(profile, todayContext.stepsCount, todayContext.workoutCalories)

  const sessionItemsText = (sessionItems ?? [])
    .slice(-10)
    .map(i => `- ${i.name}: ${Math.round(i.calories)} kcal (P${Math.round(i.protein)} C${Math.round(i.carbs)} F${Math.round(i.fat)})`)
    .join('\n')

  const systemPrompt = buildSystemPrompt(profile, breakdown, todayContext, today, sessionItemsText)

  const historyText = params.history
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const fullPrompt = historyText
    ? `${systemPrompt}\n\nRecent conversation:\n${historyText}\n\nUser: ${message}`
    : `${systemPrompt}\n\nUser: ${message}`

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

  const primary = makeModel(PRIMARY_MODEL, { json: true, schema: chatResponseSchema })
  const fallback = makeModel(FALLBACK_MODEL, { json: true, schema: chatResponseSchema })
  type GenerateContentArg = Parameters<typeof primary.generateContent>[0]

  const result = await generateWithRetry([
    () => primary.generateContent(parts as GenerateContentArg).then(r => ({ text: r.response.text() })),
    () => fallback.generateContent(parts as GenerateContentArg).then(r => ({ text: r.response.text() })),
  ], 'chat')

  if (!result.ok) return { aiError: result.error }

  let flat: FlatChatResponse
  try {
    flat = JSON.parse(result.text)
  } catch {
    return { aiError: 'parse' }
  }

  return toChatResponse(flat, profile)
}
