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

  const systemPrompt = `You are a personal nutrition assistant embedded in a calorie tracking app.

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
{"intent":"food_log","items":[{"name":"...","brand":"","serving_size":"...","serving_unit":"...","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0,"saturated_fat":0,"cholesterol":0,"commentary":"1-2 sentence plain English explanation of the estimate for fact-checking, e.g. standard portion size, typical calorie range, macros breakdown"}],"message":"brief friendly acknowledgement"}

2. Workout logging (text description of workout, or Apple Health/fitness screenshot):
{"intent":"workout","activeCalories":0,"message":"brief confirmation with details"}

3. Steps update (user says how many steps they did today):
{"intent":"steps","steps":0,"stepsCalories":0,"message":"brief confirmation with kcal added to budget"}
Note: stepsCalories = steps × 0.000571 × ${profile.weight_kg}

4. General question (nutrition advice, progress query, anything else):
{"intent":"question","message":"your answer as plain conversational text"}

Important rules:
- Always include commentary on food items explaining the estimate basis
- For workout screenshots, read the active calories burned from the screen
- For steps, calculate stepsCalories = steps × 0.000571 × ${profile.weight_kg}
- Keep message fields brief and friendly
- If unclear whether something is food or a question, lean toward food_log`

  const historyText = params.history
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const fullPrompt = historyText
    ? `${systemPrompt}\n\nRecent conversation:\n${historyText}\n\nUser: ${message}`
    : `${systemPrompt}\n\nUser: ${message}`

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })

  // Build parts array: text first, then images
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
