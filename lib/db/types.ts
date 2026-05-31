export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active'

export type UserProfile = {
  id: string
  user_id: string
  date_of_birth: string      // ISO date e.g. "1995-03-14"
  sex: 'male' | 'female'
  height_cm: number
  weight_kg: number
  height_unit: 'cm' | 'ft'
  weight_unit: 'kg' | 'lbs'
  goal: 'lose' | 'maintain' | 'gain'
  activity_level?: ActivityLevel
  bmr: number
  tdee?: number
  deficit_amount: number
  target_calories: number
  protein_target_g: number
  carbs_target_g: number
  fat_target_g: number
  updated_at: string
}

export type FoodEntry = {
  id: string
  user_id: string
  date: string
  name: string
  brand?: string
  serving_size: string
  serving_unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  saturated_fat: number
  cholesterol: number
  note?: string
  image_url?: string
  commentary?: string
  source: 'ai_search' | 'ai_vision' | 'manual'
  created_at: string
}

export type WeightEntry = {
  id: string
  user_id: string
  date: string
  weight_kg: number
  note?: string
  created_at: string
}

export type DailyActivity = {
  id: string
  user_id: string
  date: string
  steps_count: number
  steps_calories: number
  workout_calories: number
  workout_description?: string
  workout_image_urls: string[]
  created_at: string
}

export type NutritionResult = {
  name: string
  brand?: string
  serving_size: string
  serving_unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  saturated_fat: number
  cholesterol: number
  commentary: string
}

export type ProfileUpdateFields = {
  goal?: 'lose' | 'maintain' | 'gain'
  activity_level?: ActivityLevel
  deficit_amount?: number
  tdee?: number
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
