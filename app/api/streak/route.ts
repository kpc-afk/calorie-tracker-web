import { NextResponse } from 'next/server'
import { getProfile, computeStreak } from '@/lib/db/queries'

export async function GET() {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ streak: 0 })
    const streak = await computeStreak(
      profile.target_calories,
      profile.tdee || Math.round(profile.bmr * 1.2),
      profile.deficit_amount,
    )
    return NextResponse.json({ streak })
  } catch (err) {
    console.error('Streak error:', err)
    return NextResponse.json({ streak: 0 })
  }
}
