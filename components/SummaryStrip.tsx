type Props = { budget: number; eaten: number }

export default function SummaryStrip({ budget, eaten }: Props) {
  const remaining = budget - eaten
  const over = remaining < 0
  const pct = budget > 0 ? Math.min(Math.round((eaten / budget) * 100), 100) : 0

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Budget</div>
          <div className="text-white font-bold text-base">{Math.round(budget)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Eaten</div>
          <div className="text-white font-bold text-base">{Math.round(eaten)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{over ? 'Over' : 'Left'}</div>
          <div className={`font-bold text-base ${over ? 'text-red-400' : 'text-green-400'}`}>
            {over ? Math.round(-remaining) : Math.round(remaining)}
          </div>
        </div>
      </div>
      <div className="mx-4 mb-2 mt-1 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: over ? '#ef4444' : '#22c55e' }} />
      </div>
    </div>
  )
}
