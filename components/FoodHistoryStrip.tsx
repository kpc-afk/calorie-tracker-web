'use client'
import { useEffect, useState } from 'react'
import { haptic } from '@/lib/utils/haptic'
import { todayString } from '@/lib/utils/format'
import { appCache } from '@/lib/utils/cache'
import MicroLabel from './ui/MicroLabel'

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
  onAdded?: () => void
}

export default function FoodHistoryStrip({ onAdded }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/entries/history')
      .then(r => r.json())
      .then((d: HistoryItem[]) => setItems(d ?? []))
  }, [])

  if (items.length === 0) return null

  async function handleAdd(item: HistoryItem) {
    haptic('medium')
    setAddedNames(prev => new Set([...prev, item.name]))
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
    appCache.invalidatePrefix('/api/entries')
    appCache.invalidatePrefix('/api/week')
    onAdded?.()
    setTimeout(() => setAddedNames(prev => {
      const next = new Set(prev)
      next.delete(item.name)
      return next
    }), 1500)
  }

  return (
    <div className="px-4 pb-2">
      <MicroLabel className="mb-1.5">Recent</MicroLabel>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {items.map(item => {
          const added = addedNames.has(item.name)
          return (
            <button
              key={item.name}
              onClick={() => handleAdd(item)}
              disabled={added}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium transition-colors border ${
                added
                  ? 'border-[var(--accent)]/40 text-[var(--accent)]'
                  : 'border-[var(--hairline)] text-[var(--ink-60)] hover:border-[var(--hairline-strong)] active:scale-95'
              }`}>
              <span className="truncate max-w-[100px]">{added ? '✓ ' : ''}{item.name}</span>
              <span className="text-[var(--muted)] tnum shrink-0">{Math.round(item.calories)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
