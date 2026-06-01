'use client'
import { useEffect, useState } from 'react'

type Props = {
  eaten: number
  budget: number
  tdee: number
  deficitAmount: number
  stepsCalories: number
  workoutCalories: number
  size?: number
}

export default function CalorieRing({ eaten, budget, tdee, deficitAmount, stepsCalories, workoutCalories, size = 230 }: Props) {
  const strokeWidth = 16
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = budget > 0 ? Math.min(eaten / budget, 1) : 0
  const over = budget > 0 && eaten > budget
  const center = size / 2
  const earnedCalories = stepsCalories + workoutCalories
  const baseTarget = tdee - deficitAmount

  const [animProgress, setAnimProgress] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimProgress(progress), 120)
    return () => clearTimeout(t)
  }, [progress])

  const strokeDash = circumference * animProgress
  const remaining = Math.max(budget - eaten, 0)
  const ringColor = over ? '#ef4444' : animProgress > 0.85 ? '#f97316' : '#22c55e'

  return (
    <div className="w-full">
      {/* Ring */}
      <div className="flex justify-center" style={{ position: 'relative' }}>
        <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
            {/* Track */}
            <circle cx={center} cy={center} r={radius} fill="none" stroke="#1c1c1e" strokeWidth={strokeWidth} />
            {/* Earned activity arc (dim green backdrop) */}
            {earnedCalories > 0 && budget > 0 && (
              <circle cx={center} cy={center} r={radius} fill="none"
                stroke="#166534" strokeWidth={strokeWidth}
                strokeDasharray={`${circumference * Math.min(earnedCalories / budget, 1)} ${circumference}`}
                strokeDashoffset={0}
                style={{ transform: `rotate(${360 * Math.min(1 - earnedCalories / budget, 1)}deg)`, transformOrigin: `${center}px ${center}px` }}
              />
            )}
            {/* Eaten fill — animated on mount */}
            <circle cx={center} cy={center} r={radius} fill="none"
              stroke={ringColor} strokeWidth={strokeWidth}
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
            />
          </svg>
          {/* Center text */}
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#52525b', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>eaten</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: over ? '#ef4444' : '#ffffff', lineHeight: 1, letterSpacing: '-2px', marginTop: 2 }}>
              {Math.round(eaten)}
            </div>
            <div style={{ fontSize: 12, color: '#3f3f46', marginTop: 3 }}>of {Math.round(budget)} kcal</div>
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: ringColor }}>
              {over ? `${Math.round(eaten - budget)} over` : `${Math.round(remaining)} left`}
            </div>
          </div>
        </div>
      </div>

      {/* Budget breakdown — full chain */}
      <div className="mt-4 bg-zinc-900 rounded-2xl p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">How your budget is built</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              <span className="text-sm text-zinc-300">Maintenance (TDEE)</span>
            </div>
            <span className="text-sm font-semibold text-zinc-300">{Math.round(tdee)} kcal</span>
          </div>
          <div className="flex items-center justify-between pl-4">
            <div className="flex items-center gap-2">
              <span className="text-zinc-600 text-xs">−</span>
              <span className="text-sm text-zinc-500">Deficit</span>
            </div>
            <span className="text-sm font-semibold text-red-500">−{Math.round(deficitAmount)} kcal</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-t border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-400" />
              <span className="text-sm text-zinc-200 font-medium">Base target</span>
            </div>
            <span className="text-sm font-bold text-white">{Math.round(baseTarget)} kcal</span>
          </div>
          {stepsCalories > 0 && (
            <div className="flex items-center justify-between pl-4">
              <div className="flex items-center gap-2">
                <span className="text-green-700 text-xs">+</span>
                <span className="text-sm text-zinc-400">Steps bonus</span>
              </div>
              <span className="text-sm font-semibold text-green-500">+{Math.round(stepsCalories)} kcal</span>
            </div>
          )}
          {workoutCalories > 0 && (
            <div className="flex items-center justify-between pl-4">
              <div className="flex items-center gap-2">
                <span className="text-green-600 text-xs">+</span>
                <span className="text-sm text-zinc-400">Workout bonus</span>
              </div>
              <span className="text-sm font-semibold text-green-400">+{Math.round(workoutCalories)} kcal</span>
            </div>
          )}
          <div className="pt-1.5 border-t border-zinc-700 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Total budget</span>
            <span className="text-sm font-bold text-white">{Math.round(budget)} kcal</span>
          </div>
          <div className="pt-1 mt-0.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Eaten</span>
              <span className="text-sm font-medium text-zinc-300">−{Math.round(eaten)} kcal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: over ? '#ef4444' : '#22c55e' }}>
                {over ? 'Over budget' : 'Remaining'}
              </span>
              <span className="text-sm font-bold" style={{ color: over ? '#ef4444' : '#22c55e' }}>
                {over ? `+${Math.round(eaten - budget)}` : Math.round(remaining)} kcal
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
