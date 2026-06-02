import { NextRequest, NextResponse } from 'next/server'
import { getRecentWeights } from '@/lib/db/queries'

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get('days') ?? 7)
    const weights = await getRecentWeights(days)
    return NextResponse.json(weights)
  } catch (err) {
    console.error('Weights error:', err)
    return NextResponse.json([])
  }
}
