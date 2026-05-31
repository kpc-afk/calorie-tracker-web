type Props = {
  eaten: number
  budget: number
  baseCalories: number
  stepsCalories: number
  workoutCalories: number
  size?: number
}

export default function CalorieRing({ eaten, budget, baseCalories, stepsCalories, workoutCalories, size = 230 }: Props) {
  const strokeWidth = 16
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = budget > 0 ? Math.min(eaten / budget, 1) : 0
  const over = budget > 0 && eaten > budget
  const strokeDash = circumference * progress
  const remaining = Math.max(budget - eaten, 0)
  const center = size / 2
  const earnedCalories = stepsCalories + workoutCalories

  return (
    <div className="w-full">
      {/* Ring */}
      <div className="flex justify-center" style={{ position: 'relative' }}>
        <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke="#1c1c1e" strokeWidth={strokeWidth} />
            {/* Earned portion indicator on track */}
            {earnedCalories > 0 && budget > 0 && (
              <circle cx={center} cy={center} r={radius} fill="none"
                stroke="#166534" strokeWidth={strokeWidth}
                strokeDasharray={`${circumference * Math.min(earnedCalories / budget, 1)} ${circumference}`}
                strokeDashoffset={0}
                style={{ transform: `rotate(${360 * Math.min(1 - earnedCalories / budget, 1)}deg)`, transformOrigin: `${center}px ${center}px` }}
              />
            )}
            {/* Eaten fill */}
            <circle cx={center} cy={center} r={radius} fill="none"
              stroke={over ? '#ef4444' : '#22c55e'} strokeWidth={strokeWidth}
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          {/* Center text */}
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#52525b', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>eaten</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: over ? '#ef4444' : '#ffffff', lineHeight: 1, letterSpacing: '-2px', marginTop: 2 }}>
              {Math.round(eaten)}
            </div>
            <div style={{ fontSize: 12, color: '#3f3f46', marginTop: 3 }}>of {Math.round(budget)} kcal</div>
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: over ? '#ef4444' : '#22c55e' }}>
              {over ? `${Math.round(eaten - budget)} over` : `${Math.round(remaining)} left`}
            </div>
          </div>
        </div>
      </div>

      {/* Budget breakdown */}
      <div className="mt-4 bg-zinc-900 rounded-2xl p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Daily budget</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-600" />
              <span className="text-sm text-zinc-300">Base target</span>
            </div>
            <span className="text-sm font-semibold text-white">{Math.round(baseCalories)} kcal</span>
          </div>
          {stepsCalories > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-700" />
                <span className="text-sm text-zinc-300">Steps bonus</span>
              </div>
              <span className="text-sm font-semibold text-green-500">+{Math.round(stepsCalories)} kcal</span>
            </div>
          )}
          {workoutCalories > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-600" />
                <span className="text-sm text-zinc-300">Workout bonus</span>
              </div>
              <span className="text-sm font-semibold text-green-400">+{Math.round(workoutCalories)} kcal</span>
            </div>
          )}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Total budget</span>
            <span className="text-sm font-bold text-white">{Math.round(budget)} kcal</span>
          </div>
        </div>
      </div>
    </div>
  )
}
