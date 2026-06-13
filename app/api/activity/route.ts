import { NextRequest, NextResponse } from 'next/server'
import { getActivityForDate, upsertActivity } from '@/lib/db/queries'
import { todayLondon } from '@/lib/utils/dates'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? todayLondon()
  const activity = await getActivityForDate(date)
  return NextResponse.json(activity)
}

export async function POST(req: NextRequest) {
  try {
    const { date, ...updates } = await req.json()
    await upsertActivity(date, updates)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Upsert activity error:', err)
    return NextResponse.json({ error: 'Failed to save activity' }, { status: 500 })
  }
}
