import { flashModel, flashModelText, parseJSON } from './gemini'
import { calculateBMR, calculateTDEE } from '@/lib/utils/calories'

type TDEEResult = {
  bmr: number
  tdee: number
  activityLevel: string
  deficitAmount: number
  targetCalories: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  explanation: string
}

export async function calculateTDEEWithAI(params: {
  dateOfBirth: string
  sex: 'male' | 'female'
  heightCm: number
  weightKg: number
  goal: 'lose' | 'maintain' | 'gain'
  activityLevel: string
}): Promise<TDEEResult> {
  const bmr = calculateBMR({
    weightKg: params.weightKg,
    heightCm: params.heightCm,
    dateOfBirth: params.dateOfBirth,
    sex: params.sex,
  })
  const tdee = calculateTDEE(bmr, params.activityLevel)

  const prompt = `
You are a nutrition expert. Given this profile, recommend a daily calorie deficit/surplus and macro targets.

BMR (Mifflin-St Jeor): ${bmr} kcal
TDEE (BMR × activity multiplier): ${tdee} kcal
Activity level: ${params.activityLevel}
Goal: ${params.goal}
Weight: ${params.weightKg} kg

Rules:
- Base your deficit/surplus on TDEE, not BMR.
- "lose": deficit 400–600 kcal/day from TDEE. Protein 2.0–2.2g/kg, moderate carbs, lower fat.
- "maintain": deficit 0. Balanced macros.
- "gain": surplus 200–300 kcal/day above TDEE. Protein 1.8–2.0g/kg, high carbs, moderate fat.
- targetCalories = TDEE - deficitAmount

Respond with JSON only:
{
  "deficitAmount": <number, positive = deficit, negative = surplus>,
  "targetCalories": <number>,
  "proteinTargetG": <number>,
  "carbsTargetG": <number>,
  "fatTargetG": <number>,
  "explanation": "<2-3 sentence plain English explanation>"
}
`

  const result = await flashModel.generateContent(prompt)
  const data = parseJSON<Omit<TDEEResult, 'bmr' | 'tdee' | 'activityLevel'>>(result.response.text())
  return { bmr, tdee, activityLevel: params.activityLevel, ...data }
}

export async function chatAboutTDEE(params: {
  message: string
  currentBMR: number
  currentTDEE: number
  currentDeficit: number
  goal: string
  weightKg: number
  history: { role: string; content: string }[]
}): Promise<string> {
  const context = `User profile: BMR ${params.currentBMR} kcal, TDEE ${params.currentTDEE} kcal, goal: ${params.goal}, weight: ${params.weightKg}kg, recommended deficit: ${params.currentDeficit} kcal/day from TDEE.`
  const historyText = params.history.map(m => `${m.role}: ${m.content}`).join('\n')
  const prompt = `${context}\n\nConversation so far:\n${historyText}\n\nUser: ${params.message}\n\nAnswer as a helpful, concise nutrition expert. Plain text only, no JSON.`
  const result = await flashModelText.generateContent(prompt)
  return result.response.text()
}
