import { NextRequest, NextResponse } from 'next/server'
import { deleteFoodEntry, updateFoodEntry } from '@/lib/db/queries'

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await deleteFoodEntry(id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  await updateFoodEntry(id, body)
  return NextResponse.json({ ok: true })
}
