import { NextRequest, NextResponse } from 'next/server'
import { SchemaType } from '@google/generative-ai'
import { makeModel, PRIMARY_MODEL, FALLBACK_MODEL } from '@/lib/ai/gemini'
import { generateWithRetry } from '@/lib/ai/client'

export const runtime = 'edge'

const servingSizeSchema = {
  type: SchemaType.OBJECT,
  properties: {
    servings: { type: SchemaType.NUMBER },
    explanation: { type: SchemaType.STRING },
  },
  required: ['servings', 'explanation'],
} as const

export async function POST(req: NextRequest) {
  try {
    const { foodName, servingSize, servingUnit, question } = await req.json()

    const prompt = `You are a nutrition assistant. A user scanned a food item and wants help figuring out how many servings they ate.

Food: ${foodName}
Labeled serving size: ${servingSize} ${servingUnit}

User says: "${question}"

Based on what the user described, calculate how many servings they ate. Be precise — use decimals if needed (e.g. 1.5, 0.75, 2.5).`

    const primary = makeModel(PRIMARY_MODEL, { json: true, schema: servingSizeSchema })
    const fallback = makeModel(FALLBACK_MODEL, { json: true, schema: servingSizeSchema })

    const result = await generateWithRetry([
      () => primary.generateContent(prompt).then(r => ({ text: r.response.text() })),
      () => fallback.generateContent(prompt).then(r => ({ text: r.response.text() })),
    ], 'serving-size')

    if (!result.ok) {
      const status = result.error === 'rate_limit' ? 429 : result.error === 'overloaded' ? 503 : 502
      return NextResponse.json({ error: result.error }, { status })
    }

    let parsed: { servings: number; explanation: string }
    try {
      parsed = JSON.parse(result.text)
    } catch {
      return NextResponse.json({ error: 'parse' }, { status: 502 })
    }

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
