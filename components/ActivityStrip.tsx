function StepsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" fill="currentColor" stroke="none" />
      <path d="M8.5 7.5L6 17h3l1-5 2 3h3l-2.5-4.5L14 7.5H8.5z" />
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5S12 12 12 12c0 0-.5 2-2.5 2.5z" />
      <path d="M12 2c0 0-4 4-4 8.5C8 14.5 10 17 12 17s4-2.5 4-6.5C16 6 12 2 12 2z" />
    </svg>
  )
}

type Props = {
  stepsCount: number
  stepsCalories: number
  workoutCalories: number
  onDeleteSteps?: () => void
  onDeleteWorkout?: () => void
}

export default function ActivityStrip({ stepsCount, stepsCalories, workoutCalories, onDeleteSteps, onDeleteWorkout }: Props) {
  const totalBoost = stepsCalories + workoutCalories
  const hasActivity = stepsCount > 0 || workoutCalories > 0

  if (!hasActivity) return (
    <div className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600">
        <StepsIcon />
      </div>
      <div>
        <div className="text-zinc-400 text-sm font-medium">No activity yet</div>
        <div className="text-zinc-600 text-xs">Log steps or workouts in Chat to earn more budget</div>
      </div>
    </div>
  )

  return (
    <div className="bg-zinc-900 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Activity</span>
        {totalBoost > 0 && (
          <span className="text-xs font-semibold text-green-500">+{Math.round(totalBoost)} kcal earned</span>
        )}
      </div>
      <div className="flex gap-3">
        {stepsCount > 0 && (
          <div className="flex-1 bg-zinc-800 rounded-xl p-3 relative">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-blue-400">
                <StepsIcon />
              </div>
              <div className="text-lg font-bold text-white">{stepsCount.toLocaleString()}</div>
            </div>
            <div className="text-xs text-zinc-500">steps · <span className="text-green-500 font-semibold">+{Math.round(stepsCalories)} kcal</span></div>
            {onDeleteSteps && (
              <button onClick={onDeleteSteps}
                className="absolute top-2 right-2 text-zinc-600 hover:text-red-400 transition-colors text-lg leading-none w-5 h-5 flex items-center justify-center">
                ×
              </button>
            )}
          </div>
        )}
        {workoutCalories > 0 && (
          <div className="flex-1 bg-zinc-800 rounded-xl p-3 relative">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-orange-400">
                <FlameIcon />
              </div>
              <div className="text-lg font-bold text-white">+{Math.round(workoutCalories)}</div>
            </div>
            <div className="text-xs text-zinc-500">workout kcal</div>
            {onDeleteWorkout && (
              <button onClick={onDeleteWorkout}
                className="absolute top-2 right-2 text-zinc-600 hover:text-red-400 transition-colors text-lg leading-none w-5 h-5 flex items-center justify-center">
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
