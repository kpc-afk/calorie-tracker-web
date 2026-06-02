import { NextRequest, NextResponse } from 'next/server'
import { deleteSavedFood } from '@/lib/db/queries'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteSavedFood(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Favorites DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
