'use client'
import { useState, useEffect } from 'react'
import type { MealTemplate, NutritionResult } from '@/lib/db/types'
import { haptic } from '@/lib/utils/haptic'
import { todayString } from '@/lib/utils/format'
import { appCache } from '@/lib/utils/cache'
import MicroLabel from './ui/MicroLabel'

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
    appCache.invalidatePrefix('/api/entries')
    appCache.invalidatePrefix('/api/week')
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
      <MicroLabel className="mb-1.5 px-1">Meal templates</MicroLabel>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => handleAdd(t)}
            disabled={adding === t.id}
            className="shrink-0 border border-[var(--hairline)] rounded-[var(--radius)] px-3 py-2 text-left transition-colors hover:border-[var(--hairline-strong)] relative group"
            style={{ minWidth: 110, maxWidth: 150 }}
          >
            <div className="text-[var(--ink)] text-xs font-medium truncate pr-4">{t.name}</div>
            <div className="text-[var(--muted)] text-xs">{t.items.length} item{t.items.length !== 1 ? 's' : ''}</div>
            <div className="text-[var(--ink-60)] text-xs tnum">{Math.round(t.total_calories)} kcal</div>
            {adding === t.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)]/90 rounded-[var(--radius)]">
                <span className="text-[11px] tnum text-[var(--accent)]">✓ Added</span>
              </div>
            )}
            <button
              onClick={e => handleDelete(t.id, e)}
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
