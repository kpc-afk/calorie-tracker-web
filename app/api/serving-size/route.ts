import { NextRequest, NextResponse } from 'next/server'
import { flashModel } from '@/lib/ai/gemini'
import { parseJSON } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  try {
    const { foodName, servingSize, servingUnit, question } = await req.json()

    const prompt = `You are a nutrition assistant. A user scanned a food item and wants help figuring out how many servings they ate.

Food: ${foodName}
Labeled serving size: ${servingSize} ${servingUnit}

User says: "${question}"

Based on what the user described, calculate how many servings they ate. Be precise — use decimals if needed (e.g. 1.5, 0.75, 2.5).

Return JSON only:
{
  "servings": <number>,
  "explanation": "<one short sentence explaining your calculation>"
}`

    const result = await flashModel.generateContent(prompt)
    const parsed = parseJSON<{ servings: number; explanation: string }>(result.response.text())

    if (!parsed.servings || parsed.servings <= 0) {
      return NextResponse.json({ error: 'Could not determine servings' }, { status: 400 })
    }

    return NextResponse.json({
      servings: Math.round(parsed.servings * 4) / 4, // round to nearest 0.25
      explanation: parsed.explanation,
    })
  } catch (err) {
    console.error('Serving size error:', err)
    return NextResponse.json({ error: 'Failed to calculate' }, { status: 500 })
  }
}
