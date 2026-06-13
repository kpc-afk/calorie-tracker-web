'use client'
import HairlineCard from './ui/HairlineCard'
import MicroLabel from './ui/MicroLabel'
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
    <HairlineCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <MicroLabel>Water</MicroLabel>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tnum text-[var(--ink-60)]">{waterMl} / {DAILY_TARGET_ML} ml</span>
          <button onClick={removeCup} disabled={waterMl <= 0}
            className="text-[var(--muted)] hover:text-[var(--ink-60)] w-5 h-5 flex items-center justify-center text-base leading-none disabled:opacity-30 transition-colors">
            −
          </button>
          <button onClick={addCup} disabled={waterMl >= DAILY_TARGET_ML}
            className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)] disabled:opacity-30 transition-opacity">
            + Cup
          </button>
        </div>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: CUPS }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-[3px] transition-colors"
            style={{ backgroundColor: i < cupsFilled ? 'var(--accent)' : 'var(--hairline)' }}
          />
        ))}
      </div>
      {waterMl >= DAILY_TARGET_ML && (
        <div className="text-[var(--accent)] text-[11px] font-medium mt-2 text-center">Daily target reached</div>
      )}
    </HairlineCard>
  )
}
