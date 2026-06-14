'use client'
import { useEffect, useState } from 'react'
import StatNumeral from './ui/StatNumeral'
import { useAnimatedNumber } from '@/lib/utils/useAnimatedNumber'
import type { BudgetBreakdown } from '@/lib/utils/calories'

type Props = {
  eaten: number
  breakdown: BudgetBreakdown
  size?: number
}

export default function CalorieRing({ eaten, breakdown, size = 230 }: Props) {
  const strokeWidth = 3
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const budget = breakdown.total
  const progress = budget > 0 ? Math.min(eaten / budget, 1) : 0
  const over = budget > 0 && eaten > budget
  const center = size / 2

  const [animProgress, setAnimProgress] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimProgress(progress), 120)
    return () => clearTimeout(t)
  }, [progress])

  const strokeDash = circumference * animProgress
  const remaining = Math.max(budget - eaten, 0)
  const overage = Math.max(eaten - budget, 0)
  const ringColor = over ? 'var(--danger)' : 'var(--accent)'

  const animEaten = useAnimatedNumber(Math.round(eaten))
  const animCenter = useAnimatedNumber(Math.round(over ? overage : remaining))

  return (
    <div className="flex justify-center">
      <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--hairline-strong)" strokeWidth={strokeWidth} />
          <circle cx={center} cy={center} r={radius} fill="none"
            stroke={ringColor} strokeWidth={strokeWidth}
            strokeDasharray={`${strokeDash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
          />
        </svg>
        <div className="text-center">
          <StatNumeral
            value={animCenter}
            label={over ? 'over' : 'remaining'}
            size="hero"
            tone={over ? 'danger' : 'accent'}
          />
          <div className="mt-3 text-[13px] tnum text-[var(--ink-60)]">
            {animEaten} / {Math.round(budget)} kcal
          </div>
        </div>
      </div>
    </div>
  )
}
