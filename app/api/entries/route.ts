import { NextRequest, NextResponse } from 'next/server'
import { getFoodEntriesForDate, insertFoodEntry } from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const entries = await getFoodEntriesForDate(date)
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await insertFoodEntry(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Insert food entry error:', err)
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 })
  }
}
