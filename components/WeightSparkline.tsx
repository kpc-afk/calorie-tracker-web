import type { WeightEntry } from '@/lib/db/types'

type Props = { weights: WeightEntry[] }

export default function WeightSparkline({ weights }: Props) {
  if (weights.length < 2) return null

  const vals = weights.map(w => w.weight_kg)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 0.1
  const W = 48, H = 16, PAD = 2

  const points = vals.map((v, i) => {
    const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2)
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  }).join(' ')

  const first = vals[0]
  const last = vals[vals.length - 1]
  const diff = last - first
  const going = diff < -0.05 ? 'down' : diff > 0.05 ? 'up' : 'flat'
  const color = going === 'down' ? '#22c55e' : going === 'up' ? '#ef4444' : '#71717a'
  const label = going === 'down' ? `↓ ${Math.abs(diff).toFixed(1)} kg` : going === 'up' ? `↑ ${diff.toFixed(1)} kg` : '→ stable'

  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: 10, color, fontWeight: 600 }}>{label} this week</span>
    </div>
  )
}
