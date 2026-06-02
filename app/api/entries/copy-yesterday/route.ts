import { NextRequest, NextResponse } from 'next/server'
import { getFoodEntriesForDate, insertFoodEntry } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  try {
    const { targetDate } = await req.json()
    if (!targetDate) return NextResponse.json({ error: 'Missing targetDate' }, { status: 400 })

    const yesterday = new Date(targetDate + 'T12:00:00')
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const [yesterdayEntries, todayEntries] = await Promise.all([
      getFoodEntriesForDate(yesterdayStr),
      getFoodEntriesForDate(targetDate),
    ])

    if (yesterdayEntries.length === 0) {
      return NextResponse.json({ copied: 0, message: 'Nothing logged yesterday' })
    }

    const todayNames = new Set(todayEntries.map(e => e.name.toLowerCase()))
    const toInsert = yesterdayEntries.filter(e => !todayNames.has(e.name.toLowerCase()))

    await Promise.all(toInsert.map(e =>
      insertFoodEntry({
        date: targetDate,
        name: e.name,
        brand: e.brand,
        serving_size: e.serving_size,
        serving_unit: e.serving_unit,
        calories: e.calories,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        fiber: e.fiber,
        sugar: e.sugar,
        sodium: e.sodium,
        saturated_fat: e.saturated_fat,
        cholesterol: e.cholesterol,
        commentary: e.commentary,
        source: 'manual',
      })
    ))

    return NextResponse.json({ copied: toInsert.length })
  } catch (err) {
    console.error('Copy yesterday error:', err)
    return NextResponse.json({ error: 'Failed to copy' }, { status: 500 })
  }
}
