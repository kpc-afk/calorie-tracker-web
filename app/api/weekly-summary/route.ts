import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/db/queries'
import { getFoodEntriesInRange } from '@/lib/db/queries'
import { getWeightHistory } from '@/lib/db/queries'
import { flashModelText } from '@/lib/ai/gemini'
import { getDailyBudget } from '@/lib/utils/calories'
import { todayLondon, addDays, weekStart } from '@/lib/utils/dates'

export async function GET() {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

    const startDate = addDays(weekStart(todayLondon()), -7) // previous week's Monday
    const endDate = addDays(startDate, 6) // previous week's Sunday

    const [entries, weights] = await Promise.all([
      getFoodEntriesInRange(startDate, endDate),
      getWeightHistory(30),
    ])

    const budget = getDailyBudget({
      tdee: profile.tdee || Math.round(profile.bmr * 1.2),
      deficitAmount: profile.deficit_amount,
      stepsCalories: 0,
      workoutCalories: 0,
    })

    const byDate: Record<string, { calories: number; protein: number }> = {}
    entries.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = { calories: 0, protein: 0 }
      byDate[e.date].calories += e.calories
      byDate[e.date].protein += e.protein
    })

    const days = Object.values(byDate)
    const avgCalories = days.length > 0 ? Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length) : 0
    const proteinHitDays = days.filter(d => d.protein >= profile.protein_target_g).length
    const onBudgetDays = days.filter(d => d.calories <= budget).length

    const recentWeights = weights.slice(-14)
    const weightChange = recentWeights.length >= 2
      ? recentWeights[recentWeights.length - 1].weight_kg - recentWeights[0].weight_kg
      : null

    const prompt = `You are a friendly nutrition coach giving a weekly recap. Be warm, specific, and motivating. Keep it to 2-3 sentences max. No markdown.

Stats for last week (${startDate} to ${endDate}):
- Days logged: ${days.length}/7
- Average daily calories: ${avgCalories} kcal (target: ${Math.round(budget)} kcal)
- Days within calorie budget: ${onBudgetDays}/7
- Days hitting protein target (${Math.round(profile.protein_target_g)}g): ${proteinHitDays}/7
- Weight change: ${weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : 'not enough data'}

Write a brief, personalized weekly recap.`

    const result = await flashModelText.generateContent(prompt)
    const summary = result.response.text().trim()

    return NextResponse.json({
      summary,
      stats: { avgCalories, proteinHitDays, onBudgetDays, daysLogged: days.length, weightChange, budget: Math.round(budget) },
      weekStart: startDate,
    })
  } catch (err) {
    console.error('Weekly summary error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
