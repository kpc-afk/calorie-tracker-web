import { NextRequest, NextResponse } from 'next/server'
import { calculateTDEEWithAI } from '@/lib/ai/tdee'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = await calculateTDEEWithAI(body)
  return NextResponse.json(result)
}
