import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? ''
    const supabase = await createClient()

    const query = supabase
      .from('food_entries')
      .select('name, calories, protein, carbs, fat, fiber, sugar, sodium, saturated_fat, cholesterol, serving_size, serving_unit')

    if (q.trim()) {
      query.ilike('name', `%${q}%`)
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(200)

    if (!data || data.length === 0) return NextResponse.json([])

    // Aggregate by name, count frequency
    const map = new Map<string, {
      name: string; calories: number; protein: number; carbs: number; fat: number
      fiber: number; sugar: number; sodium: number; saturated_fat: number; cholesterol: number
      serving_size: number; serving_unit: string; count: number
    }>()

    for (const e of data) {
      const key = e.name.toLowerCase()
      if (map.has(key)) {
        map.get(key)!.count++
      } else {
        map.set(key, { ...e, count: 1 })
      }
    }

    const results = [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, q.trim() ? 6 : 8)

    return NextResponse.json(results)
  } catch (err) {
    console.error('History error:', err)
    return NextResponse.json([])
  }
}
