import { NextResponse } from 'next/server'
import { getFoodEntriesInRange } from '@/lib/db/queries'

export async function GET() {
  try {
    const entries = await getFoodEntriesInRange('2020-01-01', new Date().toISOString().split('T')[0])
    return NextResponse.json(entries)
  } catch (err) {
    console.error('Get all entries error:', err)
    return NextResponse.json([])
  }
}
