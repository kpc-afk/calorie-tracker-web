'use client'
import { useState, useEffect } from 'react'
import type { MealTemplate, NutritionResult } from '@/lib/db/types'
import { haptic } from '@/lib/utils/haptic'
import { todayString } from '@/lib/utils/format'

type Props = {
  refreshKey?: number
  onAdd: (items: NutritionResult[], name: string) => void
}

export default function MealTemplatesStrip({ refreshKey, onAdd }: Props) {
  const [templates, setTemplates] = useState<MealTemplate[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(d ?? []))
  }, [refreshKey])

  if (templates.length === 0) return null

  async function handleAdd(template: MealTemplate) {
    setAdding(template.id)
    haptic('medium')
    await Promise.all(template.items.map(item =>
      fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayString(),
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          sugar: item.sugar,
          sodium: item.sodium,
          saturated_fat: item.saturated_fat,
          cholesterol: item.cholesterol,
          serving_size: item.serving_size,
          serving_unit: item.serving_unit,
          source: 'manual',
        }),
      })
    ))
    onAdd(template.items, template.name)
    setTimeout(() => setAdding(null), 1200)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="px-3 pb-2">
      <div className="text-zinc-600 text-xs font-semibold uppercase tracking-wider mb-1.5 px-1">Meal Templates</div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => handleAdd(t)}
            disabled={adding === t.id}
            className="shrink-0 bg-zinc-800/80 border border-zinc-700 rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-700 active:bg-zinc-600 relative group"
            style={{ minWidth: 110, maxWidth: 150 }}
          >
            <div className="text-white text-xs font-semibold truncate pr-4">{t.name}</div>
            <div className="text-zinc-500 text-xs">{t.items.length} item{t.items.length !== 1 ? 's' : ''}</div>
            <div className="text-green-400 text-xs font-bold">{Math.round(t.total_calories)} kcal</div>
            {adding === t.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/90 rounded-xl">
                <span className="text-green-400 text-xs font-bold">✓ Added</span>
              </div>
            )}
            <button
              onClick={e => handleDelete(t.id, e)}
              className="absolute top-1 right-1 text-zinc-600 hover:text-red-400 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center"
            >
              ×
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}
