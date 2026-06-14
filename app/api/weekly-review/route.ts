import { NextResponse } from 'next/server'
import { getProfile, getInsight, upsertInsight } from '@/lib/db/queries'
import { makeModel, PRIMARY_MODEL, FALLBACK_MODEL, parseJSON } from '@/lib/ai/gemini'
import { generateWithRetry } from '@/lib/ai/client'
import { buildCoachDigest } from '@/lib/ai/digest'
import { todayLondon, isoWeekKey } from '@/lib/utils/dates'

export const runtime = 'edge'

export type WeeklyReview = { wins: string[]; concerns: string[]; focus: string }

const SCHEMA = {
  type: 'object',
  properties: {
    wins: { type: 'array', items: { type: 'string' } },
    concerns: { type: 'array', items: { type: 'string' } },
    focus: { type: 'string' },
  },
  required: ['wins', 'concerns', 'focus'],
}

export async function GET() {
  try {
    const periodKey = isoWeekKey(todayLondon())
    const existing = await getInsight('weekly_review', periodKey)
    if (existing) return NextResponse.json({ exists: true, review: existing.content as unknown as WeeklyReview })
    return NextResponse.json({ exists: false })
  } catch (err) {
    console.error('Weekly review fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch weekly review' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

    const digest = await buildCoachDigest()

    const prompt = `${digest}

Based on this data, write a weekly review with three parts:
- "wins": 1-3 short factual things that went well, citing specific numbers
- "concerns": 0-2 short factual things to watch, citing specific numbers (omit if nothing notable)
- "focus": one sentence — the single most useful thing to focus on next week

Be direct and numeric. No cheerleading, no fluff. Return JSON matching the schema.`

    const primary = makeModel(PRIMARY_MODEL, { temperature: 0.4, json: true, schema: SCHEMA })
    const fallback = makeModel(FALLBACK_MODEL, { temperature: 0.4, json: true, schema: SCHEMA })

    const result = await generateWithRetry([
      () => primary.generateContent(prompt).then(r => ({ text: r.response.text() })),
      () => fallback.generateContent(prompt).then(r => ({ text: r.response.text() })),
    ], 'weekly-review')

    if (!result.ok) {
      const status = result.error === 'rate_limit' ? 429 : result.error === 'overloaded' ? 503 : 502
      return NextResponse.json({ error: result.error }, { status })
    }

    const review = parseJSON<WeeklyReview>(result.text)
    const periodKey = isoWeekKey(todayLondon())
    await upsertInsight('weekly_review', periodKey, { ...review })

    return NextResponse.json({ exists: true, review })
  } catch (err) {
    console.error('Weekly review generation error:', err)
    return NextResponse.json({ error: 'Failed to generate weekly review' }, { status: 500 })
  }
}
