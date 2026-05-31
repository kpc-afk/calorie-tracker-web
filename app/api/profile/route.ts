import { NextRequest, NextResponse } from 'next/server'
import { getProfile, upsertProfile } from '@/lib/db/queries'

export async function GET() {
  try {
    const profile = await getProfile()
    return NextResponse.json(profile)
  } catch (err) {
    console.error('Get profile error:', err)
    return NextResponse.json(null)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await upsertProfile(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Save profile error:', err)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
