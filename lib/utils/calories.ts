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

export function stepsToCalories(steps: number, weightKg: number): number {
  return Math.round(steps * 0.000571 * weightKg)
}

export function getDailyBudget(params: {
  bmr: number
  deficitAmount: number
  stepsCalories: number
  workoutCalories: number
}): number {
  return Math.round(
    params.bmr - params.deficitAmount + params.stepsCalories + params.workoutCalories
  )
}
