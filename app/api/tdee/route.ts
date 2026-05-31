import { NextRequest, NextResponse } from 'next/server'
import { calculateTDEEWithAI } from '@/lib/ai/tdee'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await calculateTDEEWithAI(body)
    return NextResponse.json(result)
  } catch (err) {
    console.error('TDEE calculation error:', err)
    return NextResponse.json({ error: 'Failed to calculate TDEE' }, { status: 500 })
  }
}
