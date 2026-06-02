import { createClient } from '@/lib/supabase/server'
import type { UserProfile, FoodEntry, WeightEntry, DailyActivity, SavedFood, MealTemplate, NutritionResult } from './types'

// Profile
export async function getProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('user_profiles').select('*').eq('id', 'me').single()
  return data
}

export async function upsertProfile(profile: Omit<UserProfile, 'id' | 'user_id' | 'updated_at'>) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error(`Auth failed: ${authError?.message ?? 'no user'}`)
  const { error } = await supabase.from('user_profiles').upsert({
    id: 'me', user_id: user.id, ...profile, updated_at: new Date().toISOString()
  })
  if (error) throw new Error(`Upsert failed: ${error.message} (code: ${error.code})`)
}

// Food entries
export async function getFoodEntriesForDate(date: string): Promise<FoodEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('food_entries').select('*')
    .eq('date', date).order('created_at', { ascending: true })
  return data ?? []
}

export async function insertFoodEntry(entry: Omit<FoodEntry, 'id' | 'user_id' | 'created_at'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('food_entries').insert({ ...entry, user_id: user!.id })
}

export async function deleteFoodEntry(id: string) {
  const supabase = await createClient()
  await supabase.from('food_entries').delete().eq('id', id)
}

export async function updateFoodEntry(id: string, updates: Partial<FoodEntry>) {
  const supabase = await createClient()
  await supabase.from('food_entries').update(updates).eq('id', id)
}

export async function getFoodEntriesInRange(startDate: string, endDate: string): Promise<FoodEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('food_entries').select('*')
    .gte('date', startDate).lte('date', endDate).order('date', { ascending: false })
  return data ?? []
}

// Daily activity
export async function getActivityForDate(date: string): Promise<DailyActivity | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('daily_activity').select('*').eq('date', date).single()
  return data
}

export async function upsertActivity(
  date: string,
  updates: Partial<Omit<DailyActivity, 'id' | 'user_id' | 'created_at'>>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const existing = await getActivityForDate(date)
  if (existing) {
    await supabase.from('daily_activity').update(updates).eq('date', date)
  } else {
    await supabase.from('daily_activity').insert({
      date, user_id: user!.id,
      steps_count: 0, steps_calories: 0, workout_calories: 0,
      workout_image_urls: [], ...updates
    })
  }
}

export async function getActivityRange(days: number): Promise<DailyActivity[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data } = await supabase.from('daily_activity').select('*')
    .gte('date', since).order('date', { ascending: false })
  return data ?? []
}

// Weight entries
export async function getWeightHistory(limitDays = 90): Promise<WeightEntry[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - limitDays * 86400000).toISOString().split('T')[0]
  const { data } = await supabase.from('weight_entries').select('*')
    .gte('date', since).order('date', { ascending: true })
  return data ?? []
}

export async function insertWeightEntry(entry: Omit<WeightEntry, 'id' | 'user_id' | 'created_at'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('weight_entries').insert({ ...entry, user_id: user!.id })
}

// Analytics
export async function getDailyCalorieTotals(days: number): Promise<{ date: string; total: number }[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data } = await supabase.from('food_entries').select('date, calories').gte('date', since)
  if (!data) return []
  const totals: Record<string, number> = {}
  data.forEach(({ date, calories }) => { totals[date] = (totals[date] ?? 0) + calories })
  return Object.entries(totals)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function computeStreak(targetCalories: number, tdee: number, deficitAmount: number): Promise<number> {
  const supabase = await createClient()
  const days = 60
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]

  const [{ data: food }, { data: activity }] = await Promise.all([
    supabase.from('food_entries').select('date, calories').gte('date', since).lt('date', todayStr),
    supabase.from('daily_activity').select('date, steps_calories, workout_calories').gte('date', since).lt('date', todayStr),
  ])

  if (!food) return 0

  const foodByDate: Record<string, number> = {}
  food.forEach(({ date, calories }) => { foodByDate[date] = (foodByDate[date] ?? 0) + calories })

  const activityByDate: Record<string, number> = {}
  activity?.forEach(({ date, steps_calories, workout_calories }) => {
    activityByDate[date] = (steps_calories ?? 0) + (workout_calories ?? 0)
  })

  const baseTarget = targetCalories || (tdee - deficitAmount)
  let streak = 0
  const d = new Date()
  d.setDate(d.getDate() - 1)

  for (let i = 0; i < days; i++) {
    const dateStr = d.toISOString().split('T')[0]
    const eaten = foodByDate[dateStr] ?? 0
    if (eaten === 0) break
    const budget = baseTarget + (activityByDate[dateStr] ?? 0)
    if (eaten > budget) break
    streak++
    d.setDate(d.getDate() - 1)
  }

  return streak
}

export async function getRecentWeights(days = 7): Promise<WeightEntry[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data } = await supabase.from('weight_entries').select('*')
    .gte('date', since).order('date', { ascending: true })
  return data ?? []
}

// Saved foods (favorites)
export async function getSavedFoods(): Promise<SavedFood[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('saved_foods').select('*').order('created_at', { ascending: false })
  return data ?? []
}

export async function saveFavoriteFood(food: Omit<SavedFood, 'id' | 'user_id' | 'created_at'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('saved_foods').insert({ ...food, user_id: user!.id })
}

export async function deleteSavedFood(id: string) {
  const supabase = await createClient()
  await supabase.from('saved_foods').delete().eq('id', id)
}

// Meal templates
export async function getMealTemplates(): Promise<MealTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('meal_templates').select('*').order('created_at', { ascending: false })
  return data ?? []
}

export async function saveMealTemplate(name: string, items: NutritionResult[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const total_calories = items.reduce((s, i) => s + i.calories, 0)
  await supabase.from('meal_templates').insert({ name, items, total_calories, user_id: user!.id })
}

export async function deleteMealTemplate(id: string) {
  const supabase = await createClient()
  await supabase.from('meal_templates').delete().eq('id', id)
}

export async function get7DayMacroAverages() {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const supabase = await createClient()
  const { data } = await supabase.from('food_entries')
    .select('date, calories, protein, carbs, fat').gte('date', since)
  if (!data || data.length === 0) {
    return { avgCalories: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, days: 0 }
  }
  const days = new Set(data.map(e => e.date)).size
  const sum = data.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
  return {
    avgCalories: Math.round(sum.calories / days),
    avgProtein: Math.round(sum.protein / days),
    avgCarbs: Math.round(sum.carbs / days),
    avgFat: Math.round(sum.fat / days),
    days,
  }
}
