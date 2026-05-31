type Props = { eaten: number; budget: number; size?: number }

export default function CalorieRing({ eaten, budget, size = 200 }: Props) {
  const radius = (size - 24) / 2
  const circumference = 2 * Math.PI * radius
  const progress = budget > 0 ? Math.min(eaten / budget, 1) : 0
  const over = budget > 0 && eaten > budget
  const strokeDash = circumference * progress
  const remaining = Math.max(budget - eaten, 0)
  const excess = Math.max(eaten - budget, 0)
  const center = size / 2

  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#3a3a3c" strokeWidth={12} />
        <circle cx={center} cy={center} r={radius} fill="none"
          stroke={over ? '#ef4444' : '#22c55e'} strokeWidth={12}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round" />
      </svg>
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{Math.round(eaten)}</div>
        <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>of {Math.round(budget)} kcal</div>
        {over
          ? <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>+{Math.round(excess)} over</div>
          : <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>{Math.round(remaining)} left</div>
        }
      </div>
    </div>
  )
}
