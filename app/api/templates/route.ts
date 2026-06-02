import { NextRequest, NextResponse } from 'next/server'
import { getMealTemplates, saveMealTemplate } from '@/lib/db/queries'

export async function GET() {
  try {
    const templates = await getMealTemplates()
    return NextResponse.json(templates)
  } catch (err) {
    console.error('Templates GET error:', err)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, items } = await req.json()
    if (!name || !items?.length) return NextResponse.json({ error: 'Missing name or items' }, { status: 400 })
    await saveMealTemplate(name, items)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Templates POST error:', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
