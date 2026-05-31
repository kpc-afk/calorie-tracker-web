'use client'
import type { FoodEntry } from '@/lib/db/types'

type Props = { entry: FoodEntry; onDelete: (id: string) => void }

export default function FoodCard({ entry, onDelete }: Props) {
  return (
    <div className="flex items-center justify-between bg-zinc-900 rounded-xl px-4 py-3">
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-white text-sm font-medium truncate">{entry.name}</div>
        <div className="text-gray-500 text-xs">{entry.serving_size} {entry.serving_unit}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-green-400 font-semibold text-sm">{Math.round(entry.calories)} kcal</div>
          <div className="text-gray-600 text-xs">P:{Math.round(entry.protein)} C:{Math.round(entry.carbs)} F:{Math.round(entry.fat)}</div>
        </div>
        <button onClick={() => onDelete(entry.id)}
          className="text-zinc-600 hover:text-red-400 transition-colors text-xl leading-none w-6 flex items-center justify-center">
          ×
        </button>
      </div>
    </div>
  )
}
