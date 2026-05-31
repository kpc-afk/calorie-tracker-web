'use client'
import { useState } from 'react'
import type { NutritionResult } from '@/lib/db/types'

type Props = {
  item: NutritionResult
  onChange: (updated: NutritionResult) => void
  onAdd: () => void
  added: boolean
}

export default function FoodItemCard({ item, onChange, onAdd, added }: Props) {
  const [expanded, setExpanded] = useState(false)

  function update(key: keyof NutritionResult, val: string | number) {
    onChange({ ...item, [key]: typeof item[key] === 'number' ? Number(val) : val })
  }

  return (
    <div className={`bg-zinc-800 rounded-2xl p-4 border transition-opacity ${added ? 'border-green-700 opacity-60' : 'border-zinc-700'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <input value={item.name} onChange={e => update('name', e.target.value)}
            className="bg-transparent text-white font-semibold text-sm w-full focus:outline-none border-b border-transparent focus:border-zinc-600 pb-0.5" />
          <div className="text-gray-500 text-xs mt-0.5">{item.serving_size} {item.serving_unit}</div>
        </div>
        <div className="text-green-400 font-bold text-lg shrink-0">{Math.round(item.calories)}</div>
      </div>

      <div className="flex gap-4 text-xs text-gray-400 mb-2">
        <span>P <span className="text-white">{Math.round(item.protein)}g</span></span>
        <span>C <span className="text-white">{Math.round(item.carbs)}g</span></span>
        <span>F <span className="text-white">{Math.round(item.fat)}g</span></span>
      </div>

      {item.commentary && (
        <p className="text-gray-500 text-xs mb-3 italic leading-relaxed">{item.commentary}</p>
      )}

      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {expanded ? 'Less ▲' : 'Edit fields ▼'}
        </button>
        <div className="flex-1" />
        {added
          ? <span className="text-green-500 text-xs font-medium">✓ Added</span>
          : <button onClick={onAdd} className="bg-green-500 text-black text-xs font-semibold px-4 py-1.5 rounded-full">Add</button>
        }
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const).map(field => (
            <div key={field}>
              <label className="text-gray-500 capitalize block mb-0.5">{field}</label>
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
