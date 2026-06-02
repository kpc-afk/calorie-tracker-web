'use client'
import { haptic } from '@/lib/utils/haptic'

const CUP_ML = 250
const DAILY_TARGET_ML = 2000
const CUPS = DAILY_TARGET_ML / CUP_ML // 8

type Props = {
  waterMl: number
  date: string
  onChange: (newMl: number) => void
}

export default function WaterTracker({ waterMl, date, onChange }: Props) {
  const cupsFilled = Math.min(Math.floor(waterMl / CUP_ML), CUPS)

  async function addCup() {
    if (waterMl >= DAILY_TARGET_ML) return
    haptic('light')
    const newMl = waterMl + CUP_ML
    onChange(newMl)
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, water_ml: newMl }),
    })
  }

  async function removeCup() {
    if (waterMl <= 0) return
    haptic('light')
    const newMl = Math.max(0, waterMl - CUP_ML)
    onChange(newMl)
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, water_ml: newMl }),
    })
  }

  return (
    <div className="bg-zinc-900 rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">💧</span>
          <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Water</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">{waterMl} / {DAILY_TARGET_ML} ml</span>
          <button onClick={removeCup} disabled={waterMl <= 0}
            className="text-zinc-600 hover:text-zinc-400 w-6 h-6 flex items-center justify-center text-lg leading-none disabled:opacity-30">
            −
          </button>
          <button onClick={addCup} disabled={waterMl >= DAILY_TARGET_ML}
            className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-bold px-2.5 py-1 rounded-full text-xs disabled:opacity-30 transition-colors">
            + cup
          </button>
        </div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: CUPS }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-full transition-colors ${i < cupsFilled ? 'bg-blue-500' : 'bg-zinc-800'}`}
          />
        ))}
      </div>
      {waterMl >= DAILY_TARGET_ML && (
        <div className="text-blue-400 text-xs font-semibold mt-1.5 text-center">Daily target reached! 🎉</div>
      )}
    </div>
  )
}
