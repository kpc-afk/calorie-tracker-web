import { NextRequest, NextResponse } from 'next/server'
import { deleteMealTemplate } from '@/lib/db/queries'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await deleteMealTemplate(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Templates DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
