import { NextRequest, NextResponse } from 'next/server'
import { getDailyCalorieTotals, get7DayMacroAverages, getWeightHistory, getActivityRange } from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get('days') ?? 7)
    const [calorieTotals, macroAverages, weightHistory, activityHistory] = await Promise.all([
      getDailyCalorieTotals(days),
      get7DayMacroAverages(),
      getWeightHistory(90),
      getActivityRange(90),
    ])
    return NextResponse.json({ calorieTotals, macroAverages, weightHistory, activityHistory })
  } catch (err) {
    console.error('Progress fetch error:', err)
    return NextResponse.json({ calorieTotals: [], macroAverages: null, weightHistory: [] }, { status: 500 })
  }
}
