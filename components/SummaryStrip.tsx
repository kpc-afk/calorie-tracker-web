'use client'
import { useEffect, useState } from 'react'

type Props = { budget: number; eaten: number }

export default function SummaryStrip({ budget, eaten }: Props) {
  const remaining = budget - eaten
  const over = remaining < 0
  const rawPct = budget > 0 ? (eaten / budget) * 100 : 0
  const pct = Math.min(rawPct, 100)
  const [animPct, setAnimPct] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setAnimPct(pct), 80)
    return () => clearTimeout(t)
  }, [pct])

  // Mini ring
  const SIZE = 52
  const SW = 5
  const R = (SIZE - SW * 2) / 2
  const C = 2 * Math.PI * R
  const dash = C * animPct / 100
  const ringColor = over ? '#ef4444' : animPct > 85 ? '#f97316' : '#22c55e'

  return (
    <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-950 px-4 py-2.5">
      <div className="flex items-center gap-4">
        {/* Mini ring */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#27272a" strokeWidth={SW} />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
              stroke={ringColor} strokeWidth={SW}
              strokeDasharray={`${dash} ${C}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
          </svg>
          <div style={{ fontSize: 10, fontWeight: 700, color: ringColor, lineHeight: 1 }}>
            {Math.round(rawPct)}%
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-1 justify-between">
          <div className="text-center">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Budget</div>
            <div className="text-white font-bold text-base leading-tight">{Math.round(budget)}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Eaten</div>
            <div className="text-white font-bold text-base leading-tight">{Math.round(eaten)}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{over ? 'Over' : 'Left'}</div>
            <div className="font-bold text-base leading-tight" style={{ color: ringColor }}>
              {Math.abs(Math.round(remaining))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
