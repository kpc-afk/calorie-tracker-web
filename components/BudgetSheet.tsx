'use client'
import { useEffect } from 'react'
import MicroLabel from './ui/MicroLabel'
import type { BudgetBreakdown } from '@/lib/utils/calories'

type Props = {
  open: boolean
  onClose: () => void
  breakdown: BudgetBreakdown
  eaten: number
}

export default function BudgetSheet({ open, onClose, breakdown, eaten }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const remaining = breakdown.total - eaten
  const over = remaining < 0
  const pct = Math.round(breakdown.earnBackRate * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-[var(--bg)] border-t border-[var(--hairline)] rounded-t-[16px] px-6 pt-3 pb-8 safe-area-pb"
        style={{ animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div className="w-10 h-1 rounded-full bg-[var(--hairline-strong)] mx-auto mb-5" />
        <div className="font-display italic text-[22px] leading-none mb-5">How today&rsquo;s budget is built</div>

        <Row label="TDEE" value={`${Math.round(breakdown.effectiveTdee)} kcal`} />
        <Row label="Deficit" value={`−${Math.round(breakdown.deficit)} kcal`} muted />
        <Row label="Base target" value={`${Math.round(breakdown.baseTarget)} kcal`} strong topBorder />

        <Row
          label="Steps"
          value={`+${breakdown.stepsBonus} kcal`}
          detail={`${breakdown.stepsCount.toLocaleString()} · −${breakdown.baselineSteps.toLocaleString()} baseline → ${pct}%`}
          topBorder
        />
        <Row
          label="Workout"
          value={`+${breakdown.workoutBonus} kcal`}
          detail={breakdown.workoutCalories > 0 ? `${breakdown.workoutCalories} kcal logged → ${pct}%` : 'none logged'}
        />

        <Row label="Total budget" value={`${Math.round(breakdown.total)} kcal`} strong topBorder />
        <Row label="Eaten" value={`${Math.round(eaten)} kcal`} muted />

        <div className="hairline-t mt-2 pt-4 flex items-end justify-between">
          <MicroLabel>{over ? 'Over' : 'Remaining'}</MicroLabel>
          <div className={`font-display tnum text-[32px] leading-none ${over ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}`}>
            {Math.abs(Math.round(remaining))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, detail, muted, strong, topBorder }: {
  label: string; value: string; detail?: string; muted?: boolean; strong?: boolean; topBorder?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${topBorder ? 'hairline-t' : ''}`}>
      <div>
        <div className={`text-[13px] ${strong ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink-60)]'}`}>{label}</div>
        {detail && <div className="text-[11px] text-[var(--muted)] tnum mt-0.5">{detail}</div>}
      </div>
      <div className={`tnum text-[15px] ${strong ? 'text-[var(--ink)] font-semibold' : muted ? 'text-[var(--ink-60)]' : 'text-[var(--ink)]'}`}>
        {value}
      </div>
    </div>
  )
}
