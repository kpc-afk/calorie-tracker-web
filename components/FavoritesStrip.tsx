'use client'
import { useState, useEffect } from 'react'
import type { SavedFood } from '@/lib/db/types'
import { haptic } from '@/lib/utils/haptic'
import { todayString } from '@/lib/utils/format'
import { appCache } from '@/lib/utils/cache'
import MicroLabel from './ui/MicroLabel'

type Props = {
  onAdd: (name: string) => void
  refreshKey?: number
}

export default function FavoritesStrip({ onAdd, refreshKey }: Props) {
  const [favorites, setFavorites] = useState<SavedFood[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/favorites').then(r => r.json()).then(d => setFavorites(d ?? []))
  }, [refreshKey])

  if (favorites.length === 0) return null

  async function handleAdd(fav: SavedFood) {
    setAdding(fav.id)
    haptic('medium')
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: todayString(),
        name: fav.name,
        calories: fav.calories,
        protein: fav.protein,
        carbs: fav.carbs,
        fat: fav.fat,
        fiber: fav.fiber,
        sugar: fav.sugar,
        sodium: fav.sodium,
        saturated_fat: fav.saturated_fat,
        cholesterol: fav.cholesterol,
        serving_size: Number(fav.serving_size) || 1,
        serving_unit: fav.serving_unit,
        source: 'manual',
      }),
    })
    appCache.invalidatePrefix('/api/entries')
    appCache.invalidatePrefix('/api/week')
    onAdd(fav.name)
    setTimeout(() => setAdding(null), 1200)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/favorites/${id}`, { method: 'DELETE' })
    setFavorites(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="px-3 pb-2">
      <MicroLabel className="mb-1.5 px-1">Favorites</MicroLabel>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {favorites.map(fav => (
          <button
            key={fav.id}
            onClick={() => handleAdd(fav)}
            disabled={adding === fav.id}
            className="shrink-0 border border-[var(--hairline)] rounded-[var(--radius)] px-3 py-2 text-left transition-colors hover:border-[var(--hairline-strong)] relative group"
            style={{ minWidth: 90, maxWidth: 130 }}
          >
            <div className="text-[var(--ink)] text-xs font-medium truncate pr-4">{fav.name}</div>
            <div className="text-[var(--ink-60)] text-xs tnum">{Math.round(fav.calories)} kcal</div>
            {adding === fav.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)]/90 rounded-[var(--radius)]">
                <span className="text-[11px] tnum text-[var(--accent)]">✓ Added</span>
              </div>
            )}
            <button
              onClick={e => handleDelete(fav.id, e)}
              className="absolute top-1 right-1 text-[var(--muted)] hover:text-[var(--danger)] text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center"
            >
              ×
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}
