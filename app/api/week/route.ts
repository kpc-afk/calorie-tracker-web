import { NextRequest, NextResponse } from 'next/server'
import { getFoodEntriesInRange, getActivityRange, getProfile } from '@/lib/db/queries'
import { getBudgetBreakdown } from '@/lib/utils/calories'
import { todayLondon, weekStart, addDays } from '@/lib/utils/dates'
import type { DayLedger } from '@/lib/utils/banking'

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date') ?? todayLondon()
    const ws = weekStart(date)

    const [entries, activities, profile] = await Promise.all([
      getFoodEntriesInRange(ws, date),
      getActivityRange(7),
      getProfile(),
    ])

    const eatenByDate: Record<string, number> = {}
    entries.forEach(e => { eatenByDate[e.date] = (eatenByDate[e.date] ?? 0) + e.calories })

    const activityByDate: Record<string, { steps_count: number; workout_calories: number }> = {}
    activities.forEach(a => { activityByDate[a.date] = a })

    const days: DayLedger[] = []
    for (let d = ws; d <= date; d = addDays(d, 1)) {
      const activity = activityByDate[d]
      const budget = profile
        ? getBudgetBreakdown(profile, activity?.steps_count ?? 0, activity?.workout_calories ?? 0).total
        : 0
      days.push({ date: d, eaten: eatenByDate[d] ?? 0, budget })
    }

    const todayBudget = days.find(d => d.date === date)?.budget ?? 0

    return NextResponse.json({ days, todayBudget })
  } catch (err) {
    console.error('Week fetch error:', err)
    return NextResponse.json({ days: [], todayBudget: 0 }, { status: 500 })
  }
}
