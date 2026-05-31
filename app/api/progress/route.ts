import { NextRequest, NextResponse } from 'next/server'
import { getDailyCalorieTotals, get7DayMacroAverages, getWeightHistory } from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get('days') ?? 7)
    const [calorieTotals, macroAverages, weightHistory] = await Promise.all([
      getDailyCalorieTotals(days),
      get7DayMacroAverages(),
      getWeightHistory(90),
    ])
    return NextResponse.json({ calorieTotals, macroAverages, weightHistory })
  } catch (err) {
    console.error('Progress fetch error:', err)
    return NextResponse.json({ calorieTotals: [], macroAverages: null, weightHistory: [] }, { status: 500 })
  }
}
