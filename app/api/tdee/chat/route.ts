import { NextRequest, NextResponse } from 'next/server'
import { chatAboutTDEE } from '@/lib/ai/tdee'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const reply = await chatAboutTDEE(body)
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('TDEE chat error:', err)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
