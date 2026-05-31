type Props = { budget: number; eaten: number }

export default function SummaryStrip({ budget, eaten }: Props) {
  const remaining = budget - eaten
  const over = remaining < 0
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-sm shrink-0">
      <span className="text-gray-400">Budget <span className="text-white font-semibold">{Math.round(budget)}</span></span>
      <span className="text-gray-400">Eaten <span className="text-white font-semibold">{Math.round(eaten)}</span></span>
      <span className={`font-semibold ${over ? 'text-red-400' : 'text-green-400'}`}>
        {over ? `+${Math.round(-remaining)} over` : `${Math.round(remaining)} left`}
      </span>
    </div>
  )
}
