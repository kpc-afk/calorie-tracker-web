type MacroProps = { label: string; value: number; target: number; color: string }

function MacroSegment({ label, value, target, color }: MacroProps) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{Math.round(value)}g</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-gray-600 text-xs mt-1">/{Math.round(target)}g</div>
    </div>
  )
}

type Props = {
  protein: number; proteinTarget: number
  carbs: number; carbsTarget: number
  fat: number; fatTarget: number
}

export default function MacroBar({ protein, proteinTarget, carbs, carbsTarget, fat, fatTarget }: Props) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-4 flex gap-5">
      <MacroSegment label="Protein" value={protein} target={proteinTarget} color="#22c55e" />
      <MacroSegment label="Carbs" value={carbs} target={carbsTarget} color="#3b82f6" />
      <MacroSegment label="Fat" value={fat} target={fatTarget} color="#f97316" />
    </div>
  )
}
