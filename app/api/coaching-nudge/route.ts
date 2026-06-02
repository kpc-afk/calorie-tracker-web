import { NextResponse } from 'next/server'
import { getProfile, getFoodEntriesInRange, getActivityRange } from '@/lib/db/queries'
import { flashModelText } from '@/lib/ai/gemini'

export async function GET() {
  try {
    const [profile, activityHistory] = await Promise.all([
      getProfile(),
      getActivityRange(14),
    ])

    const today = new Date().toISOString().split('T')[0]
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
    const foodEntries = await getFoodEntriesInRange(twoWeeksAgo, today)

    // Compute per-day summaries
    const foodByDay: Record<string, number> = {}
    for (const e of foodEntries) {
      foodByDay[e.date] = (foodByDay[e.date] ?? 0) + e.calories
    }

    const actByDay: Record<string, { steps: number; workoutKcal: number }> = {}
    for (const a of activityHistory) {
      actByDay[a.date] = { steps: a.steps_count, workoutKcal: a.workout_calories }
    }

    const budget = profile?.target_calories ?? 1800
    const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const allDates = Object.keys(foodByDay).sort()
    const dailyRows = allDates.map(date => {
      const day = DOW[new Date(date + 'T12:00:00').getDay()]
      const act = actByDay[date]
      const earned = (act?.steps ?? 0) * 0.000571 * (profile?.weight_kg ?? 75) + (act?.workoutKcal ?? 0)
      const effectiveBudget = budget + earned
      const kcal = foodByDay[date]
      return `${date} (${day}): ${Math.round(kcal)} kcal eaten, budget ${Math.round(effectiveBudget)} kcal (${kcal > effectiveBudget ? 'over' : 'under'})`
    }).join('\n')

    const prompt = `Based on this user's last 14 days of nutrition data, write exactly ONE concise, specific, forward-looking coaching insight (1-2 sentences max). Focus on a concrete pattern you notice and what they can do about it. Be direct and encouraging, not generic.

User goal: ${profile?.goal ?? 'lose weight'}
Daily calorie data:
${dailyRows || 'Limited data available'}

Respond with just the insight, no preamble.`

    const result = await flashModelText.generateContent(prompt)
    const insight = result.response.text().trim()

    return NextResponse.json({ insight })
  } catch (err) {
    console.error('Coaching nudge error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
