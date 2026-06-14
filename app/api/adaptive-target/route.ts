import { NextRequest, NextResponse } from 'next/server'
import { getProfile, getFoodEntriesInRange, getWeightHistory, getInsight, upsertInsight, updateProfileFields } from '@/lib/db/queries'
import type { UserProfile } from '@/lib/db/types'
import { todayLondon, daysAgoLondon, isoWeekKey } from '@/lib/utils/dates'
import { computeTrendAndTdee } from '@/lib/utils/analytics'
import { suggestTargetAdjustment, type TargetSuggestion } from '@/lib/utils/adaptive'

const TARGET_RATE_PER_WEEK_KG = -0.55

async function computeSuggestion(profile: UserProfile): Promise<TargetSuggestion> {
  const today = todayLondon()
  const start60 = daysAgoLondon(60)

  const [entries, weights] = await Promise.all([
    getFoodEntriesInRange(start60, today),
    getWeightHistory(60),
  ])

  const eatenByDate = new Map<string, number>()
  entries.forEach(e => eatenByDate.set(e.date, (eatenByDate.get(e.date) ?? 0) + e.calories))

  const rawPoints = weights.map(w => ({ date: w.date, weight_kg: w.weight_kg }))
  const { tdee, reliable, ratePerWeekKg } = computeTrendAndTdee(rawPoints, eatenByDate, today)

  return suggestTargetAdjustment({
    tdeeEstimate: tdee,
    reliable,
    currentBase: profile.target_calories,
    currentDeficit: profile.deficit_amount,
    trendRatePerWeekKg: ratePerWeekKg,
    targetRatePerWeekKg: TARGET_RATE_PER_WEEK_KG,
  })
}

export async function GET() {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

    const periodKey = isoWeekKey(todayLondon())
    const existing = await getInsight('target_suggestion', periodKey)
    if (existing) return NextResponse.json({ suggest: false })

    const suggestion = await computeSuggestion(profile)
    return NextResponse.json(suggestion)
  } catch (err) {
    console.error('Adaptive target fetch error:', err)
    return NextResponse.json({ error: 'Failed to compute suggestion' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

    const { action } = await req.json() as { action?: string }
    if (action !== 'apply' && action !== 'dismiss') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const suggestion = await computeSuggestion(profile)
    const periodKey = isoWeekKey(todayLondon())

    if (action === 'apply') {
      if (!suggestion.suggest || suggestion.newBase === undefined || suggestion.newDeficit === undefined) {
        return NextResponse.json({ error: 'Nothing to apply' }, { status: 400 })
      }
      await updateProfileFields({ target_calories: suggestion.newBase, deficit_amount: suggestion.newDeficit })
    }

    await upsertInsight('target_suggestion', periodKey, { action, ...suggestion })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Adaptive target action error:', err)
    return NextResponse.json({ error: 'Failed to record action' }, { status: 500 })
  }
}
