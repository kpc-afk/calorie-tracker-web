'use client'
import type { FoodEntry } from '@/lib/db/types'

type Props = { entry: FoodEntry; onDelete: (id: string) => void }

export default function FoodCard({ entry, onDelete }: Props) {
  const proteinKcal = entry.protein * 4
  const carbsKcal = entry.carbs * 4
  const fatKcal = entry.fat * 9
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal

  return (
    <div className="flex items-center justify-between bg-zinc-900 rounded-xl px-4 py-3 gap-3">
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
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-green-400 font-bold text-sm">{Math.round(entry.calories)}</div>
          <div className="text-zinc-600 text-xs">kcal</div>
        </div>
        <button onClick={() => onDelete(entry.id)}
          className="text-zinc-700 hover:text-red-400 transition-colors text-xl leading-none w-6 flex items-center justify-center">
          ×
        </button>
      </div>
    </div>
  )
}
