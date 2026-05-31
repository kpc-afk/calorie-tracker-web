import { NextRequest, NextResponse } from 'next/server'
import { chatAboutTDEE } from '@/lib/ai/tdee'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const reply = await chatAboutTDEE(body)
  return NextResponse.json({ reply })
}
