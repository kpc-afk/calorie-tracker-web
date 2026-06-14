import { NextResponse } from 'next/server'
import { getProfile, getFoodEntriesInRange, getWeightHistory, getActivityRange } from '@/lib/db/queries'
import { makeModel, PRIMARY_MODEL, FALLBACK_MODEL } from '@/lib/ai/gemini'
import { generateWithRetry } from '@/lib/ai/client'
import { getBudgetBreakdown } from '@/lib/utils/calories'
import { todayLondon, addDays, weekStart } from '@/lib/utils/dates'
import { ewmaTrend } from '@/lib/utils/analytics'

export const runtime = 'edge'

export async function GET() {
  try {
    const profileResult = await getProfile()
    if (!profileResult) return NextResponse.json({ error: 'No profile' }, { status: 400 })
    const profile = profileResult

    const startDate = addDays(weekStart(todayLondon()), -7) // previous week's Monday
    const endDate = addDays(startDate, 6) // previous week's Sunday

    const [entries, weights, activity] = await Promise.all([
      getFoodEntriesInRange(startDate, endDate),
      getWeightHistory(30),
      getActivityRange(14),
    ])

    const activityByDate: Record<string, { steps_count: number; workout_calories: number }> = {}
    activity.forEach(a => {
      if (a.date >= startDate && a.date <= endDate) {
        activityByDate[a.date] = { steps_count: a.steps_count, workout_calories: a.workout_calories }
      }
    })

    const byDate: Record<string, { calories: number; protein: number }> = {}
    entries.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = { calories: 0, protein: 0 }
      byDate[e.date].calories += e.calories
      byDate[e.date].protein += e.protein
    })

    const days = Object.entries(byDate).map(([date, totals]) => {
      const act = activityByDate[date]
      const dayBudget = getBudgetBreakdown(profile, act?.steps_count ?? 0, act?.workout_calories ?? 0).total
      return { ...totals, budget: dayBudget }
    })
    const avgCalories = days.length > 0 ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length) : 0
    const avgBudget = days.length > 0
      ? Math.round(days.reduce((s, d) => s + d.budget, 0) / days.length)
      : Math.round(getBudgetBreakdown(profile, 0, 0).total)
    const proteinHitDays = days.filter(d => d.protein >= profile.protein_target_g).length
    const onBudgetDays = days.filter(d => d.calories <= d.budget).length
    const avgDeficit = avgBudget - avgCalories

    // weight change: EWMA trend delta across the previous week's window
    const trend = ewmaTrend(weights)
    const trendInWindow = trend.filter(p => p.date >= startDate && p.date <= endDate)
    const weightChange = trendInWindow.length >= 2
      ? Math.round((trendInWindow[trendInWindow.length - 1].trend - trendInWindow[0].trend) * 10) / 10
      : null

    const prompt = `You are a data-driven nutrition coach. Write a direct, numeric weekly recap — no cheerleading, no exclamation points, no fluff. State the facts and one useful observation. 2-3 sentences max. No markdown.

Stats for last week (${startDate} to ${endDate}):
- Days logged: ${days.length}/7
- Average daily intake: ${avgCalories} kcal vs average budget ${avgBudget} kcal (${avgDeficit >= 0 ? `${avgDeficit} kcal deficit` : `${-avgDeficit} kcal over`} on average)
- Days within calorie budget: ${onBudgetDays}/7
- Days hitting protein target (${Math.round(profile.protein_target_g)}g): ${proteinHitDays}/7
- Trend weight change: ${weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : 'not enough data'}

Example tone: "You logged 6/7 days and averaged a 480 kcal deficit, putting trend weight down 0.4kg. Protein landed short on 3 days — worth tightening up if preserving muscle matters."

Write the recap now.`

    const primary = makeModel(PRIMARY_MODEL, { temperature: 0.4 })
    const fallback = makeModel(FALLBACK_MODEL, { temperature: 0.4 })

    const result = await generateWithRetry([
      () => primary.generateContent(prompt).then(r => ({ text: r.response.text() })),
      () => fallback.generateContent(prompt).then(r => ({ text: r.response.text() })),
    ], 'weekly-summary')

    if (!result.ok) {
      const status = result.error === 'rate_limit' ? 429 : result.error === 'overloaded' ? 503 : 502
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      summary: result.text.trim(),
      stats: { avgCalories, avgBudget, proteinHitDays, onBudgetDays, daysLogged: days.length, weightChange },
      weekStart: startDate,
    })
  } catch (err) {
    console.error('Weekly summary error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
