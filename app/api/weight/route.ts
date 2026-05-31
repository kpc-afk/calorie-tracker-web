import { NextRequest, NextResponse } from 'next/server'
import { insertWeightEntry } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await insertWeightEntry(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Weight entry error:', err)
    return NextResponse.json({ error: 'Failed to log weight' }, { status: 500 })
  }
}
