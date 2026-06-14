import HairlineCard from './ui/HairlineCard'
import MicroLabel from './ui/MicroLabel'

function StepsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" fill="currentColor" stroke="none" />
      <path d="M8.5 7.5L6 17h3l1-5 2 3h3l-2.5-4.5L14 7.5H8.5z" />
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  if (!hasActivity) {
    return (
      <HairlineCard className="p-4">
        <MicroLabel className="mb-1.5">Activity</MicroLabel>
        <div className="text-[13px] text-[var(--ink-60)]">No steps or workouts logged — tell the AI in Chat</div>
      </HairlineCard>
    )
  }

  return (
    <HairlineCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <MicroLabel>Activity</MicroLabel>
        {totalBoost > 0 && (
          <span className="text-[11px] tnum text-[var(--accent)]">+{Math.round(totalBoost)} kcal earned</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {stepsCount > 0 ? (
          <div className="relative">
            <div className="flex items-center gap-1.5 text-[var(--muted)] mb-1">
              <StepsIcon />
              <span className="font-display tnum text-[26px] leading-none text-[var(--ink)]">{stepsCount.toLocaleString()}</span>
            </div>
            <div className="text-[11px] tnum text-[var(--ink-60)]">steps · <span className="text-[var(--accent)]">+{Math.round(stepsCalories)}</span></div>
            {onDeleteSteps && (
              <button onClick={onDeleteSteps}
                className="absolute -top-1 -right-1 text-[var(--muted)] hover:text-[var(--danger)] transition-colors text-base leading-none w-5 h-5 flex items-center justify-center">
                ×
              </button>
            )}
          </div>
        ) : <div />}
        {workoutCalories > 0 ? (
          <div className="relative">
            <div className="flex items-center gap-1.5 text-[var(--muted)] mb-1">
              <FlameIcon />
              <span className="font-display tnum text-[26px] leading-none text-[var(--ink)]">+{Math.round(workoutCalories)}</span>
            </div>
            <div className="text-[11px] tnum text-[var(--ink-60)]">workout kcal</div>
            {onDeleteWorkout && (
              <button onClick={onDeleteWorkout}
                className="absolute -top-1 -right-1 text-[var(--muted)] hover:text-[var(--danger)] transition-colors text-base leading-none w-5 h-5 flex items-center justify-center">
                ×
              </button>
            )}
          </div>
        ) : <div />}
      </div>
    </HairlineCard>
  )
}
