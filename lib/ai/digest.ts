import { getProfile, getFoodEntriesInRange, getWeightHistory, getActivityRange } from '@/lib/db/queries'
import { getBudgetBreakdown } from '@/lib/utils/calories'
import { computeTrendAndTdee } from '@/lib/utils/analytics'
import { computeWeekBank, type DayLedger } from '@/lib/utils/banking'
import { todayLondon, daysAgoLondon, weekStart, addDays } from '@/lib/utils/dates'

const GOAL_WEIGHT_KG = 72 // single-user app; profile has no goal-weight column

/** Compact plain-text snapshot of the user's recent data for AI coach prompts. */
export async function buildCoachDigest(): Promise<string> {
  const profileResult = await getProfile()
  if (!profileResult) return 'No profile data available.'
  const profile = profileResult

  const today = todayLondon()
  const start28 = daysAgoLondon(28)

  const [entries, weights, activity] = await Promise.all([
    getFoodEntriesInRange(start28, today),
    getWeightHistory(60),
    getActivityRange(28),
  ])

  const eatenByDate = new Map<string, number>()
  const proteinByDate = new Map<string, number>()
  entries.forEach(e => {
    eatenByDate.set(e.date, (eatenByDate.get(e.date) ?? 0) + e.calories)
    proteinByDate.set(e.date, (proteinByDate.get(e.date) ?? 0) + e.protein)
  })

  const activityByDate = new Map<string, { steps_count: number; workout_calories: number }>()
  activity.forEach(a => activityByDate.set(a.date, { steps_count: a.steps_count, workout_calories: a.workout_calories }))

  function budgetForDate(date: string): number {
    const act = activityByDate.get(date)
    return getBudgetBreakdown(profile, act?.steps_count ?? 0, act?.workout_calories ?? 0).total
  }

  const rawPoints = weights.map(w => ({ date: w.date, weight_kg: w.weight_kg }))
  const { trendPoints, tdee, reliable, ratePerWeekKg } = computeTrendAndTdee(rawPoints, eatenByDate, today)
  const lastTrend = trendPoints[trendPoints.length - 1]

  const loggedDates28 = [...eatenByDate.keys()].filter(d => d >= start28 && d <= today)
  const loggedDays = loggedDates28.length
  const avgIntake = loggedDays > 0
    ? Math.round(loggedDates28.reduce((sum, d) => sum + (eatenByDate.get(d) ?? 0), 0) / loggedDays)
    : 0
  const avgDeficit = loggedDays > 0
    ? Math.round(loggedDates28.reduce((sum, d) => sum + (budgetForDate(d) - (eatenByDate.get(d) ?? 0)), 0) / loggedDays)
    : 0
  const proteinFloorHitDays = loggedDates28.filter(d => (proteinByDate.get(d) ?? 0) >= profile.protein_target_g).length

  const ws = weekStart(today)
  const weekDates: string[] = []
  for (let d = ws; d <= today; d = addDays(d, 1)) weekDates.push(d)
  const weekLedger: DayLedger[] = weekDates.map(d => ({ date: d, eaten: eatenByDate.get(d) ?? 0, budget: budgetForDate(d) }))
  const weekBank = computeWeekBank(weekLedger, today, budgetForDate(today))
  const workoutDaysThisWeek = weekDates.filter(d => (activityByDate.get(d)?.workout_calories ?? 0) > 0).length

  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const last7Line = last7.map(d => {
    const eaten = eatenByDate.get(d)
    const dayName = new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
    if (eaten === undefined) return `${dayName} — no data`
    const budget = budgetForDate(d)
    return `${dayName} ${eaten}/${budget} ${eaten <= budget ? '✓' : '✗'}`
  }).join(' · ')

  const currentWeight = lastTrend ? lastTrend.trend : profile.weight_kg
  const trendLine = lastTrend ? `, trend ${lastTrend.trend.toFixed(1)}kg, ${ratePerWeekKg >= 0 ? '+' : ''}${ratePerWeekKg.toFixed(2)}kg/wk` : ''

  return [
    `PROFILE: ${currentWeight.toFixed(1)}kg${trendLine}, goal ${GOAL_WEIGHT_KG}kg (${profile.goal}), base target ${Math.round(profile.target_calories)} kcal, protein floor ${Math.round(profile.protein_target_g)}g`,
    `TDEE: estimated ${tdee} kcal from last 21d (${reliable ? 'reliable' : 'unreliable — limited data'})`,
    `LAST 28D: logged ${loggedDays}/28 days · avg intake ${avgIntake} kcal · avg ${avgDeficit >= 0 ? 'deficit' : 'over'} ${Math.abs(avgDeficit)} · protein floor hit ${proteinFloorHitDays}/${loggedDays || 1}`,
    `THIS WEEK: bank ${weekBank.bank >= 0 ? '+' : ''}${weekBank.bank} kcal · ${workoutDaysThisWeek} workout day${workoutDaysThisWeek === 1 ? '' : 's'}`,
    `LAST 7 DAYS: ${last7Line}`,
  ].join('\n')
}
