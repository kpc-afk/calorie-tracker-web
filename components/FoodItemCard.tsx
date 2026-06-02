'use client'
import { useState } from 'react'
import type { NutritionResult } from '@/lib/db/types'
import { haptic } from '@/lib/utils/haptic'

type Props = {
  item: NutritionResult
  onChange: (updated: NutritionResult) => void
  onAdd: () => void
  added: boolean
  addLabel?: string
}

export default function FoodItemCard({ item, onChange, onAdd, added, addLabel }: Props) {
  const [expanded, setExpanded] = useState(false)

  function update(key: keyof NutritionResult, val: string | number) {
    onChange({ ...item, [key]: typeof item[key] === 'number' ? Number(val) : val })
  }

  const proteinKcal = item.protein * 4
  const carbsKcal = item.carbs * 4
  const fatKcal = item.fat * 9
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal

  return (
    <div className={`bg-zinc-800 rounded-2xl p-4 border transition-opacity ${added ? 'border-green-700 opacity-60' : 'border-zinc-700'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <input value={item.name} onChange={e => update('name', e.target.value)}
            className="bg-transparent text-white font-semibold text-sm w-full focus:outline-none border-b border-transparent focus:border-zinc-600 pb-0.5" />
          <div className="text-zinc-500 text-xs mt-0.5">{item.serving_size} {item.serving_unit}</div>
        </div>
        <div className="text-green-400 font-bold text-xl shrink-0">{Math.round(item.calories)}<span className="text-xs font-normal text-zinc-500 ml-0.5">kcal</span></div>
      </div>

      {/* Macro row */}
      <div className="flex gap-3 text-xs mb-2">
        <span className="font-semibold text-emerald-400">{Math.round(item.protein)}g <span className="text-zinc-600 font-normal">P</span></span>
        <span className="font-semibold text-blue-400">{Math.round(item.carbs)}g <span className="text-zinc-600 font-normal">C</span></span>
        <span className="font-semibold text-orange-400">{Math.round(item.fat)}g <span className="text-zinc-600 font-normal">F</span></span>
      </div>

      {/* Macro proportion bar */}
      {totalMacroKcal > 0 && (
        <div className="h-1 bg-zinc-700 rounded-full overflow-hidden flex mb-3">
          <div style={{ width: `${(proteinKcal / totalMacroKcal) * 100}%`, backgroundColor: '#10b981' }} />
          <div style={{ width: `${(carbsKcal / totalMacroKcal) * 100}%`, backgroundColor: '#3b82f6' }} />
          <div style={{ width: `${(fatKcal / totalMacroKcal) * 100}%`, backgroundColor: '#f97316' }} />
        </div>
      )}

      {item.commentary && (
        <p className="text-zinc-500 text-xs mb-3 italic leading-relaxed">{item.commentary}</p>
      )}

      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {expanded ? 'Less ▲' : 'Edit fields ▼'}
        </button>
        <div className="flex-1" />
        {added
          ? <span className="text-green-500 text-xs font-medium">✓ Added</span>
          : <button onClick={() => { haptic('medium'); onAdd() }} className="bg-green-500 text-black text-xs font-bold px-4 py-1.5 rounded-full">{addLabel ?? 'Add'}</button>
        }
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const).map(field => (
            <div key={field}>
              <label className="text-zinc-500 capitalize block mb-0.5">{field}</label>
              <input type="number" value={item[field] as number}
                onChange={e => update(field, e.target.value)}
                className="w-full bg-zinc-900 text-white rounded-lg px-2 py-1.5 focus:outline-none border border-zinc-700 focus:border-zinc-500" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
