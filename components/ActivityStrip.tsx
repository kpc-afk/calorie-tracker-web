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
      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm">+</div>
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
      <div className="flex gap-4">
        {stepsCount > 0 && (
          <div className="flex-1 bg-zinc-800 rounded-xl p-3 relative">
            <div className="text-lg font-bold text-white">{stepsCount.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-0.5">steps · <span className="text-green-500">+{Math.round(stepsCalories)} kcal</span></div>
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
            <div className="text-lg font-bold text-white">+{Math.round(workoutCalories)}</div>
            <div className="text-xs text-zinc-500 mt-0.5">workout kcal</div>
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
