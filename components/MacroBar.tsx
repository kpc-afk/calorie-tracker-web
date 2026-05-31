type MacroProps = { label: string; value: number; target: number; color: string; accent: string }

function MacroSegment({ label, value, target, color, accent }: MacroProps) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  const over = value > target && target > 0
  return (
    <div className="flex-1">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>{label}</span>
        <span className="text-xs text-zinc-500">/{Math.round(target)}g</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: over ? '#ef4444' : color }} />
      </div>
      <div className="text-white font-bold text-lg mt-1.5 leading-none">{Math.round(value)}<span className="text-xs font-normal text-zinc-500 ml-0.5">g</span></div>
    </div>
  )
}

type Props = {
  protein: number; proteinTarget: number
  carbs: number; carbsTarget: number
  fat: number; fatTarget: number
}

export default function MacroBar({ protein, proteinTarget, carbs, carbsTarget, fat, fatTarget }: Props) {
  const proteinPct = proteinTarget > 0 ? Math.min((protein / proteinTarget) * 100, 100) : 0
  const proteinOver = protein > proteinTarget && proteinTarget > 0
  const proteinRemaining = Math.max(proteinTarget - protein, 0)

  return (
    <div className="space-y-3">
      {/* Protein — featured */}
      <div className="bg-zinc-900 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-green-500">Protein</span>
            <span className="text-xs text-zinc-600">floor: {Math.round(proteinTarget)}g</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: proteinOver ? '#22c55e' : proteinPct >= 80 ? '#22c55e' : '#71717a' }}>
            {proteinOver ? '✓ hit' : `${Math.round(proteinRemaining)}g to go`}
          </span>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${proteinPct}%`, backgroundColor: proteinOver ? '#22c55e' : '#22c55e', opacity: proteinOver ? 1 : 0.85 }} />
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-2xl font-bold text-white">{Math.round(protein)}<span className="text-sm font-normal text-zinc-500 ml-0.5">g</span></span>
          <span className="text-xs text-zinc-600">{Math.round(proteinPct)}%</span>
        </div>
      </div>

      {/* Carbs + Fat — compact */}
      <div className="bg-zinc-900 rounded-2xl p-4 flex gap-6">
        <MacroSegment label="Carbs" value={carbs} target={carbsTarget} color="#3b82f6" accent="#3b82f6" />
        <div className="w-px bg-zinc-800" />
        <MacroSegment label="Fat" value={fat} target={fatTarget} color="#f97316" accent="#f97316" />
      </div>
    </div>
  )
}
