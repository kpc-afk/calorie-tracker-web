import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { stepsToCalories } from '@/lib/utils/calories'
import { todayLondon } from '@/lib/utils/dates'

function authorized(req: NextRequest): boolean {
  const secret = process.env.HEALTH_SYNC_SECRET
  const header = req.headers.get('authorization') ?? ''
  if (!secret || !header.startsWith('Bearer ')) return false
  const token = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return token.length === expected.length && timingSafeEqual(token, expected)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayLondon()
  const steps = Number.isFinite(+body.steps) ? Math.round(+body.steps) : null
  const activeEnergy = Number.isFinite(+body.active_energy_kcal) ? Math.round(+body.active_energy_kcal) : null
  const weightKg = Number.isFinite(+body.weight_kg) && +body.weight_kg > 30 && +body.weight_kg < 250 ? +body.weight_kg : null

  const admin = createAdminClient()
  const { data: profile } = await admin.from('user_profiles').select('user_id, weight_kg').limit(1).single()
  if (!profile) return NextResponse.json({ error: 'no profile' }, { status: 500 })

  const updates: Record<string, unknown> = {}
  if (steps !== null) {
    updates.steps_count = steps
    updates.steps_calories = stepsToCalories(steps, profile.weight_kg)
  }
  if (activeEnergy !== null) {
    const grossStepsKcal = steps !== null ? stepsToCalories(steps, profile.weight_kg) : 0
    updates.workout_calories = Math.max(0, activeEnergy - grossStepsKcal) // avoid double-counting steps
  }
  if (Object.keys(updates).length > 0) {
    await admin.from('daily_activity').upsert(
      { user_id: profile.user_id, date, ...updates },
      { onConflict: 'user_id,date' }
    )
  }
  if (weightKg !== null) {
    const { data: existing } = await admin.from('weight_entries')
      .select('id').eq('user_id', profile.user_id).eq('date', date).maybeSingle()
    if (existing) await admin.from('weight_entries').update({ weight_kg: weightKg }).eq('id', existing.id)
    else await admin.from('weight_entries').insert({ user_id: profile.user_id, date, weight_kg: weightKg })
  }
  return NextResponse.json({ ok: true, date, applied: { steps, activeEnergy, weightKg } })
}
