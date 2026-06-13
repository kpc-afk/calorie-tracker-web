import HairlineCard from './ui/HairlineCard'
import MicroLabel from './ui/MicroLabel'
import type { DayLedger, WeekBank } from '@/lib/utils/banking'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

type Props = {
  days: DayLedger[]
  weekBank: WeekBank
}

export default function BankingStrip({ days, weekBank }: Props) {
  const { bank, effectiveTodayAllowance } = weekBank
  const positive = bank >= 0

  return (
    <HairlineCard className="p-4">
      <div className="flex items-center justify-between mb-4">
        <MicroLabel>Week</MicroLabel>
        <div className={`tnum text-[15px] font-medium ${positive ? 'text-[var(--accent)]' : 'text-[var(--danger)]'}`}>
          {positive ? '+' : '−'}{Math.abs(bank)} kcal
        </div>
      </div>
      <div className="flex items-stretch gap-2 h-9 mb-3">
        {DAY_LETTERS.map((letter, i) => {
          const d = days[i]
          const ratio = d && d.budget > 0 ? d.eaten / d.budget : 0
          const over = ratio > 1
          const fillPct = Math.min(ratio, 1) * 100
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex-1 bg-[var(--hairline)] relative overflow-hidden flex flex-col justify-end">
                {d && (
                  <div
                    className="w-full"
                    style={{ height: `${fillPct}%`, backgroundColor: over ? 'var(--danger)' : 'var(--accent)' }}
                  />
                )}
              </div>
              <span className="text-[9px] text-[var(--muted)]">{letter}</span>
            </div>
          )
        })}
      </div>
      <div className="text-[11px] text-[var(--ink-60)] tnum">
        incl. bank: {effectiveTodayAllowance} kcal today
      </div>
    </HairlineCard>
  )
}
