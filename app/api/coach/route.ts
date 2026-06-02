import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getFoodEntriesInRange, getWeightHistory, getActivityRange } from '@/lib/db/queries'
import { flashModelText } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'No message' }, { status: 400 })

    const [profile, weightHistory, activityHistory] = await Promise.all([
      getProfile(),
      getWeightHistory(30),
      getActivityRange(14),
    ])

    const today = new Date().toISOString().split('T')[0]
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
    const foodEntries = await getFoodEntriesInRange(twoWeeksAgo, today)

    // Summarize food entries by day
    const foodByDay: Record<string, { calories: number; protein: number; carbs: number; fat: number; items: string[] }> = {}
    for (const e of foodEntries) {
      if (!foodByDay[e.date]) foodByDay[e.date] = { calories: 0, protein: 0, carbs: 0, fat: 0, items: [] }
      foodByDay[e.date].calories += e.calories
      foodByDay[e.date].protein += e.protein
      foodByDay[e.date].carbs += e.carbs
      foodByDay[e.date].fat += e.fat
      foodByDay[e.date].items.push(e.name)
    }

    const activityByDay: Record<string, { steps: number; workoutKcal: number }> = {}
    for (const a of activityHistory) {
      activityByDay[a.date] = { steps: a.steps_count, workoutKcal: a.workout_calories }
    }

    const dailySummary = Object.keys({ ...foodByDay, ...activityByDay })
      .sort()
      .slice(-14)
      .map(date => {
        const food = foodByDay[date]
        const act = activityByDay[date]
        const parts = []
        if (food) parts.push(`ate ${Math.round(food.calories)} kcal (P${Math.round(food.protein)}g C${Math.round(food.carbs)}g F${Math.round(food.fat)}g): ${food.items.slice(0, 5).join(', ')}${food.items.length > 5 ? '…' : ''}`)
        if (act?.steps) parts.push(`${act.steps.toLocaleString()} steps (+${Math.round(act.steps * 0.000571 * (profile?.weight_kg ?? 75))} kcal)`)
        if (act?.workoutKcal) parts.push(`workout +${act.workoutKcal} kcal`)
        return `${date}: ${parts.join(', ') || 'no data'}`
      })
      .join('\n')

    const weightSummary = weightHistory.slice(-10).map(w => `${w.date}: ${w.weight_kg} kg`).join(', ')

    const systemPrompt = `You are a knowledgeable, direct, and supportive personal nutrition coach with full access to the user's data.

USER PROFILE:
- Goal: ${profile?.goal ?? 'unknown'}
- BMR: ${Math.round(profile?.bmr ?? 0)} kcal, TDEE: ${Math.round(profile?.tdee ?? profile?.bmr ?? 0)} kcal
- Daily target: ${Math.round(profile?.target_calories ?? 0)} kcal (deficit: ${Math.round(profile?.deficit_amount ?? 0)} kcal)
- Macro targets: ${Math.round(profile?.protein_target_g ?? 0)}g protein, ${Math.round(profile?.carbs_target_g ?? 0)}g carbs, ${Math.round(profile?.fat_target_g ?? 0)}g fat

LAST 14 DAYS:
${dailySummary || 'No food data available'}

WEIGHT HISTORY (last 30 days):
${weightSummary || 'No weight data'}

Your role: Answer nutrition questions, analyze patterns, give specific actionable advice, and help the user reach their goal. Be direct and specific — cite actual numbers from their data. Do NOT log food or modify their data. Keep responses concise (2-4 sentences unless a detailed breakdown is asked for).`

    const chatHistory = (history ?? []).slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }))

    const chat = flashModelText.startChat({
      history: chatHistory,
      systemInstruction: systemPrompt,
    })

    const result = await chat.sendMessage(message)
    const reply = result.response.text()

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('Coach error:', err)
    return NextResponse.json({ error: 'Coach failed' }, { status: 500 })
  }
}
