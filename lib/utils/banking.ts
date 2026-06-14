import { weekStart } from './dates'

export type DayLedger = { date: string; eaten: number; budget: number }
export type WeekBank = {
  weekStart: string
  bank: number                      // Σ(budget − eaten) over elapsed days before `today`
  effectiveTodayAllowance: number   // today's budget + bank, floored at 1200
  days: DayLedger[]
}

export function computeWeekBank(elapsedDays: DayLedger[], today: string, todayBudget: number): WeekBank {
  const ws = weekStart(today)
  const prior = elapsedDays.filter(d => d.date >= ws && d.date < today)
  const bank = Math.round(prior.reduce((s, d) => s + (d.budget - d.eaten), 0))
  return {
    weekStart: ws,
    bank,
    effectiveTodayAllowance: Math.max(1200, Math.round(todayBudget + bank)),
    days: prior,
  }
}
