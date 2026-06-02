import { NextRequest, NextResponse } from 'next/server'
import { getSavedFoods, saveFavoriteFood } from '@/lib/db/queries'

export async function GET() {
  try {
    const foods = await getSavedFoods()
    return NextResponse.json(foods)
  } catch (err) {
    console.error('Favorites GET error:', err)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await saveFavoriteFood(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Favorites POST error:', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
