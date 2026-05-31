type Props = { stepsCount: number; stepsCalories: number; workoutCalories: number }

export default function ActivityStrip({ stepsCount, stepsCalories, workoutCalories }: Props) {
  if (stepsCount === 0 && workoutCalories === 0) return (
    <div className="bg-zinc-900 rounded-2xl p-4 text-center text-gray-600 text-sm">
      Log steps and workouts in Chat to boost your budget
    </div>
  )
  return (
    <div className="bg-zinc-900 rounded-2xl p-4 flex gap-4">
      {stepsCount > 0 && (
        <div className="flex-1 text-center">
          <div className="text-2xl mb-1">👟</div>
          <div className="text-white font-semibold text-sm">{stepsCount.toLocaleString()}</div>
          <div className="text-gray-400 text-xs">steps · +{Math.round(stepsCalories)} kcal</div>
        </div>
      )}
      {workoutCalories > 0 && (
        <div className="flex-1 text-center">
          <div className="text-2xl mb-1">🏃</div>
          <div className="text-white font-semibold text-sm">+{Math.round(workoutCalories)}</div>
          <div className="text-gray-400 text-xs">workout kcal</div>
        </div>
      )}
    </div>
  )
}
