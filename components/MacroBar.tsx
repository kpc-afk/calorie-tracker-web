import MicroLabel from './ui/MicroLabel'
import HairlineCard from './ui/HairlineCard'

type SegmentProps = { label: string; value: number; cap: number; isFloor?: boolean }

function MacroSegment({ label, value, cap, isFloor }: SegmentProps) {
  const pct = cap > 0 ? Math.min((value / cap) * 100, 100) : 0
  const over = cap > 0 && value > cap
  const remaining = Math.max(cap - value, 0)
  const floorHit = isFloor && value >= cap && cap > 0
  const fillColor = !isFloor && over ? 'var(--danger)' : 'var(--accent)'

  return (
    <div className="flex-1">
      <MicroLabel className="mb-2">{label}</MicroLabel>
      <div className="h-[2px] bg-[var(--hairline)] overflow-hidden">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: fillColor }} />
      </div>
      <div className="font-display tnum text-[26px] leading-none text-[var(--ink)] mt-2">
        {Math.round(value)}<span className="text-[0.45em] text-[var(--muted)] ml-1">g</span>
      </div>
      <div className={`mt-1 text-[11px] tnum ${floorHit ? 'text-[var(--accent)]' : over ? 'text-[var(--danger)]' : 'text-[var(--ink-60)]'}`}>
        {isFloor
          ? (floorHit ? '✓ floor hit' : `${Math.round(remaining)}g to go`)
          : `/ ${Math.round(cap)}g`}
      </div>
    </div>
  )
}

type Props = {
  protein: number; proteinTarget: number
  carbs: number; carbsTarget: number
  fat: number; fatTarget: number
  carbHeadroom?: number
}

export default function MacroBar({ protein, proteinTarget, carbs, carbsTarget, fat, fatTarget, carbHeadroom }: Props) {
  return (
    <HairlineCard className="p-4">
      <div className="grid grid-cols-3 gap-4">
        <MacroSegment label="Protein" value={protein} cap={proteinTarget} isFloor />
        <MacroSegment label="Carbs" value={carbs} cap={carbHeadroom ?? carbsTarget} />
        <MacroSegment label="Fat" value={fat} cap={fatTarget} />
      </div>
    </HairlineCard>
  )
}
