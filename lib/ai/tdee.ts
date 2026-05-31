import { flashModel, flashModelText, parseJSON } from './gemini'
import { calculateBMR } from '@/lib/utils/calories'

type TDEEResult = {
  bmr: number
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
}): Promise<TDEEResult> {
  const bmr = calculateBMR({
    weightKg: params.weightKg,
    heightCm: params.heightCm,
    dateOfBirth: params.dateOfBirth,
    sex: params.sex,
  })

  const prompt = `
You are a nutrition expert. Given this profile, recommend a daily calorie deficit/surplus and macro targets.

BMR (calculated via Mifflin-St Jeor): ${bmr} kcal
Goal: ${params.goal}
Weight: ${params.weightKg} kg

Rules:
- "lose": deficit 300–500 kcal/day (never exceed 25% below BMR). Protein 2.0–2.2g/kg, moderate carbs, lower fat.
- "maintain": deficit 0. Balanced macros.
- "gain": surplus 200–300 kcal/day. Protein 1.8–2.0g/kg, high carbs, moderate fat.

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
  const data = parseJSON<Omit<TDEEResult, 'bmr'>>(result.response.text())
  return { bmr, ...data }
}

export async function chatAboutTDEE(params: {
  message: string
  currentBMR: number
  currentDeficit: number
  goal: string
  weightKg: number
  history: { role: string; content: string }[]
}): Promise<string> {
  const context = `User profile: BMR ${params.currentBMR} kcal, goal: ${params.goal}, weight: ${params.weightKg}kg, recommended deficit: ${params.currentDeficit} kcal/day.`
  const historyText = params.history.map(m => `${m.role}: ${m.content}`).join('\n')
  const prompt = `${context}\n\nConversation so far:\n${historyText}\n\nUser: ${params.message}\n\nAnswer as a helpful, concise nutrition expert. Plain text only, no JSON.`
  const result = await flashModelText.generateContent(prompt)
  return result.response.text()
}
