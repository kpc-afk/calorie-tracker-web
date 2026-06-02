'use client'
import { useEffect, useState, useRef } from 'react'
import { haptic } from '@/lib/utils/haptic'
import { todayString } from '@/lib/utils/format'

type HistoryItem = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  saturated_fat: number
  cholesterol: number
  serving_size: number
  serving_unit: string
  count: number
}

type Props = {
  query: string
  onAdded?: () => void
  onDismiss?: () => void
}

export default function FoodHistoryDropdown({ query, onAdded, onDismiss }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.trim().length < 2) { setItems([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/entries/history?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((d: HistoryItem[]) => setItems(d ?? []))
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  if (items.length === 0) return null

  async function handleAdd(item: HistoryItem) {
    haptic('medium')
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: todayString(),
        name: item.name,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber ?? 0,
        sugar: item.sugar ?? 0,
        sodium: item.sodium ?? 0,
        saturated_fat: item.saturated_fat ?? 0,
        cholesterol: item.cholesterol ?? 0,
        serving_size: item.serving_size ?? 1,
        serving_unit: item.serving_unit ?? 'serving',
        source: 'history',
      }),
    })
    onAdded?.()
    onDismiss?.()
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-xl z-20">
      <div className="px-3 py-1.5 border-b border-zinc-800">
        <span className="text-zinc-600 text-xs font-semibold uppercase tracking-wider">Quick add from history</span>
      </div>
      {items.map((item, i) => (
        <button
          key={item.name}
          onClick={() => handleAdd(item)}
          className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors ${i < items.length - 1 ? 'border-b border-zinc-800' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm truncate">{item.name}</div>
            <div className="text-zinc-500 text-xs mt-0.5">
              P{Math.round(item.protein)}g · C{Math.round(item.carbs)}g · F{Math.round(item.fat)}g
            </div>
          </div>
          <div className="shrink-0 ml-3 text-right">
            <div className="text-green-400 font-semibold text-sm">{Math.round(item.calories)}</div>
            <div className="text-zinc-600 text-xs">kcal</div>
          </div>
        </button>
      ))}
    </div>
  )
}
