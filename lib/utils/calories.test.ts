import { describe, it, expect } from 'vitest'
import { getEffectiveTdee, getBudgetBreakdown } from './calories'

const profile = {
  tdee: 2100, bmr: 1755, weight_kg: 83, deficit_amount: 600,
  baseline_steps: 5000, earn_back_rate: 0.75,
}

describe('budget model v2', () => {
  it('getEffectiveTdee falls back to bmr*1.2', () => {
    expect(getEffectiveTdee({ tdee: 2100, bmr: 1755 })).toBe(2100)
    expect(getEffectiveTdee({ tdee: undefined, bmr: 1755 })).toBe(2106)
  })
  it('steps below baseline earn nothing', () => {
    const b = getBudgetBreakdown(profile, 4000, 0)
    expect(b.stepsBonus).toBe(0)
    expect(b.total).toBe(1500)
  })
  it('10k steps + stairmaster lands near stated workout-day target', () => {
    const b = getBudgetBreakdown(profile, 10000, 200)
    // (10000-5000) * 0.000571 * 83 * 0.75 ≈ 178; 200*0.75 = 150
    expect(b.stepsBonus).toBe(178) // (10000−5000) × 0.000571 × 83 × 0.75
    expect(b.workoutBonus).toBe(150)
    expect(b.total).toBe(1828) // 1500 + 178 + 150
  })
  it('missing knobs default to 5000 / 0.75', () => {
    const b = getBudgetBreakdown({ ...profile, baseline_steps: undefined, earn_back_rate: undefined } as never, 10000, 0)
    expect(b.stepsBonus).toBe(178)
  })
})
