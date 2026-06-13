'use client'
import { useState, useRef } from 'react'
import type { FoodEntry } from '@/lib/db/types'
import { haptic } from '@/lib/utils/haptic'

type Props = { entry: FoodEntry; onDelete: (id: string) => void }

export default function FoodCard({ entry, onDelete }: Props) {
  const [saved, setSaved] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isDragging = useRef(false)

  async function handleSave() {
    setSaved(true)
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: entry.name,
        serving_size: String(entry.serving_size),
        serving_unit: entry.serving_unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fiber: entry.fiber,
        sugar: entry.sugar,
        sodium: entry.sodium,
        saturated_fat: entry.saturated_fat,
        cholesterol: entry.cholesterol,
      }),
    })
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isDragging.current = false
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!isDragging.current && Math.abs(dy) > Math.abs(dx)) return // vertical scroll, ignore
    isDragging.current = true
    if (dx < 0) setSwipeX(Math.max(dx, -80))
  }

  function handleTouchEnd() {
    if (swipeX < -50) {
      setSwipeX(-80) // snap open
    } else {
      setSwipeX(0) // snap back
    }
  }

  function handleDelete() {
    haptic('light')
    setSwipeX(0)
    onDelete(entry.id)
  }

  return (
    <div className="relative overflow-hidden" style={{ animation: 'slideUp 0.18s ease-out' }}>
      {/* Delete zone behind */}
      <div className="absolute inset-y-0 right-0 w-20 bg-[var(--danger)] flex items-center justify-center">
        <button onClick={handleDelete} className="text-[var(--bg)] text-[10px] font-semibold uppercase tracking-[0.08em] px-3">Delete</button>
      </div>

      {/* Card content */}
      <div
        className="flex items-center justify-between bg-[var(--bg)] py-3 gap-3 relative hairline-t"
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 || swipeX === -80 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[var(--ink)] text-[14px] truncate">{entry.name}</div>
          <div className="text-[11px] tnum text-[var(--ink-60)] mt-0.5">
            {Math.round(entry.protein)}g P · {Math.round(entry.carbs)}g C · {Math.round(entry.fat)}g F
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={handleSave} disabled={saved}
            className={`text-base leading-none transition-colors ${saved ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink-60)]'}`}
            title={saved ? 'Saved to favorites' : 'Save to favorites'}>
            ★
          </button>
          <div className="font-display tnum text-[20px] leading-none text-[var(--ink)] text-right">
            {Math.round(entry.calories)}<span className="text-[0.5em] text-[var(--muted)] ml-1">kcal</span>
          </div>
          <button onClick={handleDelete}
            className="text-[var(--muted)] hover:text-[var(--danger)] transition-colors text-xl leading-none w-5 flex items-center justify-center">
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
