import { createClient } from '@/lib/supabase/server'
import type { UserProfile, FoodEntry, WeightEntry, DailyActivity } from './types'

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
