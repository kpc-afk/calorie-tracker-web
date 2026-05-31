import type { FoodEntry } from '@/lib/db/types'

function escapeCSV(val: unknown): string {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s
}

export function generateFoodCSV(entries: FoodEntry[]): string {
  const headers = [
    'Date','Name','Brand','Serving','Unit','Calories',
    'Protein','Carbs','Fat','Fiber','Sugar','Sodium',
    'SatFat','Cholesterol','Source','Note'
  ]
  const rows = entries.map(e => [
    e.date, e.name, e.brand ?? '', e.serving_size, e.serving_unit,
    e.calories, e.protein, e.carbs, e.fat, e.fiber, e.sugar,
    e.sodium, e.saturated_fat, e.cholesterol, e.source, e.note ?? ''
  ].map(escapeCSV).join(','))
  return [headers.join(','), ...rows].join('\n')
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
