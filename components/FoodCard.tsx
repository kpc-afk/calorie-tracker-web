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

  const proteinKcal = entry.protein * 4
  const carbsKcal = entry.carbs * 4
  const fatKcal = entry.fat * 9
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal

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
    <div className="relative overflow-hidden rounded-xl" style={{ animation: 'slideUp 0.18s ease-out' }}>
      {/* Delete zone behind */}
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center rounded-r-xl">
        <button onClick={handleDelete} className="text-white text-xs font-bold px-3 py-2">Delete</button>
      </div>

      {/* Card content */}
      <div
        className="flex items-center justify-between bg-zinc-900 px-4 py-3 gap-3 relative"
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 || swipeX === -80 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">{entry.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-semibold text-emerald-400">{Math.round(entry.protein)}g P</span>
            <span className="text-zinc-700 text-xs">·</span>
            <span className="text-xs font-semibold text-blue-400">{Math.round(entry.carbs)}g C</span>
            <span className="text-zinc-700 text-xs">·</span>
            <span className="text-xs font-semibold text-orange-400">{Math.round(entry.fat)}g F</span>
          </div>
          {totalMacroKcal > 0 && (
            <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden flex">
              <div style={{ width: `${(proteinKcal / totalMacroKcal) * 100}%`, backgroundColor: '#10b981' }} />
              <div style={{ width: `${(carbsKcal / totalMacroKcal) * 100}%`, backgroundColor: '#3b82f6' }} />
              <div style={{ width: `${(fatKcal / totalMacroKcal) * 100}%`, backgroundColor: '#f97316' }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleSave} disabled={saved}
            className={`text-base leading-none transition-colors ${saved ? 'text-yellow-400' : 'text-zinc-700 hover:text-yellow-400'}`}
            title={saved ? 'Saved to favorites' : 'Save to favorites'}>
            ★
          </button>
          <div className="text-right ml-1">
            <div className="text-green-400 font-bold text-sm">{Math.round(entry.calories)}</div>
            <div className="text-zinc-600 text-xs">kcal</div>
          </div>
          <button onClick={handleDelete}
            className="text-zinc-700 hover:text-red-400 transition-colors text-xl leading-none w-6 flex items-center justify-center">
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
