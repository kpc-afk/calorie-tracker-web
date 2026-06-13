import { describe, it, expect } from 'vitest'
import { computeWeekBank } from './banking'

const day = (date: string, eaten: number, budget: number) => ({ date, eaten, budget })

describe('computeWeekBank', () => {
  it('banks unspent budget from elapsed days, excluding today', () => {
    const r = computeWeekBank([day('2026-06-08', 1400, 1500), day('2026-06-09', 1700, 1500)], '2026-06-10', 1500)
    expect(r.bank).toBe(-100) // +100 then −200
    expect(r.effectiveTodayAllowance).toBe(1400)
  })
  it('floors effective allowance at 1200', () => {
    const r = computeWeekBank([day('2026-06-08', 2400, 1500)], '2026-06-09', 1500)
    expect(r.effectiveTodayAllowance).toBe(1200)
  })
})
