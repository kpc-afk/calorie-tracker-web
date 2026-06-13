import { NextResponse } from 'next/server'
import { getProfile, getFoodEntriesInRange, getWeightHistory, getActivityRange } from '@/lib/db/queries'
import { getBudgetBreakdown } from '@/lib/utils/calories'
import { todayLondon, daysAgoLondon, addDays, isoWeekKey } from '@/lib/utils/dates'
import { ewmaTrend, backCalcTdee, goalEta, foodPatterns } from '@/lib/utils/analytics'

const GOAL_WEIGHT_KG = 72 // single-user app; profile has no goal-weight column

export async function GET() {
  try {
    const profileResult = await getProfile()
    if (!profileResult) return NextResponse.json({ error: 'No profile' }, { status: 400 })
    const profile = profileResult

    const today = todayLondon()
    const start60 = daysAgoLondon(60)

    const [entries, weights, activities] = await Promise.all([
      getFoodEntriesInRange(start60, today),
      getWeightHistory(60),
      getActivityRange(60),
    ])

    const activityByDate: Record<string, { steps_count: number; workout_calories: number }> = {}
    activities.forEach(a => { activityByDate[a.date] = a })

    function budgetForDate(date: string): number {
      const act = activityByDate[date]
      return getBudgetBreakdown(profile, act?.steps_count ?? 0, act?.workout_calories ?? 0).total
    }

    const eatenByDate = new Map<string, number>()
    const proteinByDate = new Map<string, number>()
    entries.forEach(e => {
      eatenByDate.set(e.date, (eatenByDate.get(e.date) ?? 0) + e.calories)
      proteinByDate.set(e.date, (proteinByDate.get(e.date) ?? 0) + e.protein)
    })

    // --- trend ---
    const rawPoints = weights.map(w => ({ date: w.date, weight_kg: w.weight_kg }))
    const trendPoints = ewmaTrend(rawPoints)

    // --- tdee: 21-day window ---
    const start21 = daysAgoLondon(21)
    const loggedDates21 = [...eatenByDate.keys()].filter(d => d >= start21 && d <= today)
    const loggedDays = loggedDates21.length
    const avgIntake = loggedDays > 0
      ? Math.round(loggedDates21.reduce((sum, d) => sum + (eatenByDate.get(d) ?? 0), 0) / loggedDays)
      : 0

    const trendInWindow = trendPoints.filter(p => p.date >= start21 && p.date <= today)
    const weighIns = trendInWindow.length
    const trendDeltaKg = trendInWindow.length >= 2
      ? trendInWindow[trendInWindow.length - 1].trend - trendInWindow[0].trend
      : 0

    const tdee = backCalcTdee({ avgIntake, trendDeltaKg, windowDays: 21, loggedDays, weighIns })

    // --- eta: rate = (last trend − trend 14 days earlier) / 2 per week ---
    const start14 = daysAgoLondon(14)
    const lastTrend = trendPoints[trendPoints.length - 1]
    const trendAt14 = [...trendPoints].filter(p => p.date <= start14).pop()
    const ratePerWeekKg = lastTrend && trendAt14 ? (lastTrend.trend - trendAt14.trend) / 2 : 0
    const eta = lastTrend
      ? goalEta({ currentTrendKg: lastTrend.trend, goalKg: GOAL_WEIGHT_KG, ratePerWeekKg, today })
      : { etaDate: null, weeks: null }

    // --- compliance: last 28 days grouped by ISO week ---
    const start28 = daysAgoLondon(28)
    const complianceMap = new Map<string, { daysLogged: number; onBudgetDays: number; proteinHitDays: number; totalIntake: number; totalBudget: number }>()
    for (let d = start28; d <= today; d = addDays(d, 1)) {
      const weekKey = isoWeekKey(d)
      const rec = complianceMap.get(weekKey) ?? { daysLogged: 0, onBudgetDays: 0, proteinHitDays: 0, totalIntake: 0, totalBudget: 0 }
      const eaten = eatenByDate.get(d)
      if (eaten !== undefined) {
        const budget = budgetForDate(d)
        rec.daysLogged++
        rec.totalIntake += eaten
        rec.totalBudget += budget
        if (eaten <= budget) rec.onBudgetDays++
        if ((proteinByDate.get(d) ?? 0) >= profile.protein_target_g) rec.proteinHitDays++
      }
      complianceMap.set(weekKey, rec)
    }
    const compliance = [...complianceMap.entries()].map(([weekKey, r]) => ({
      weekKey,
      daysLogged: r.daysLogged,
      onBudgetDays: r.onBudgetDays,
      proteinHitDays: r.proteinHitDays,
      avgIntake: r.daysLogged > 0 ? Math.round(r.totalIntake / r.daysLogged) : 0,
      avgBudget: r.daysLogged > 0 ? Math.round(r.totalBudget / r.daysLogged) : 0,
    }))

    // --- patterns ---
    const overBudgetDates = new Set<string>()
    eatenByDate.forEach((eaten, date) => { if (eaten > budgetForDate(date)) overBudgetDates.add(date) })
    const patterns = foodPatterns(entries.map(e => ({ date: e.date, name: e.name, calories: e.calories })), overBudgetDates)

    // --- weekday vs weekend ---
    let weekdayTotal = 0, weekdayCount = 0, weekendTotal = 0, weekendCount = 0
    eatenByDate.forEach((eaten, date) => {
      const dow = new Date(`${date}T12:00:00Z`).getUTCDay() // 0 = Sun, 6 = Sat
      if (dow === 0 || dow === 6) { weekendTotal += eaten; weekendCount++ }
      else { weekdayTotal += eaten; weekdayCount++ }
    })
    const weekdayWeekend = {
      weekday: weekdayCount > 0 ? Math.round(weekdayTotal / weekdayCount) : 0,
      weekend: weekendCount > 0 ? Math.round(weekendTotal / weekendCount) : 0,
    }

    return NextResponse.json({
      trend: { points: trendPoints, raw: rawPoints },
      tdee,
      eta,
      compliance,
      patterns,
      weekdayWeekend,
    })
  } catch (err) {
    console.error('Analytics fetch error:', err)
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 })
  }
}
