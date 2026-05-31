export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
}

export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  moderately_active: 'Moderately active',
  very_active: 'Very active',
  extra_active: 'Extra active',
}

export const ACTIVITY_DESCRIPTIONS: Record<string, string> = {
  sedentary: 'Desk job, mostly sitting, minimal movement',
  lightly_active: 'Light exercise 1–3×/week, some walking',
  moderately_active: 'Moderate exercise 3–5×/week, active lifestyle',
  very_active: 'Hard training 6–7×/week or physical job',
  extra_active: 'Intense daily training + physical job',
}

export function calculateBMR(params: {
  weightKg: number
  heightCm: number
  dateOfBirth: string   // ISO date "YYYY-MM-DD"
  sex: 'male' | 'female'
}): number {
  const { weightKg, heightCm, dateOfBirth, sex } = params
  const today = new Date()
  const dob = new Date(dateOfBirth)
  const age =
    today.getFullYear() - dob.getFullYear() -
    (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
  // Mifflin-St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2
  return Math.round(bmr * multiplier)
}

export function stepsToCalories(steps: number, weightKg: number): number {
  return Math.round(steps * 0.000571 * weightKg)
}

export function getDailyBudget(params: {
  tdee: number
  deficitAmount: number
  stepsCalories: number
  workoutCalories: number
}): number {
  return Math.round(
    params.tdee - params.deficitAmount + params.stepsCalories + params.workoutCalories
  )
}
