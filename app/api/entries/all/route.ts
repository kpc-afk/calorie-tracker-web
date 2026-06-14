import { NextResponse } from 'next/server'
import { getFoodEntriesInRange } from '@/lib/db/queries'
import { todayLondon } from '@/lib/utils/dates'

export async function GET() {
  try {
    const entries = await getFoodEntriesInRange('2020-01-01', todayLondon())
    return NextResponse.json(entries)
  } catch (err) {
    console.error('Get all entries error:', err)
    return NextResponse.json([])
  }
}
