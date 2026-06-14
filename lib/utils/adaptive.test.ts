import { describe, it, expect } from 'vitest'
import { suggestTargetAdjustment } from './adaptive'

const base = { tdeeEstimate: 2200, reliable: true, currentBase: 1500, currentDeficit: 600, trendRatePerWeekKg: -0.3, targetRatePerWeekKg: -0.55 }

describe('suggestTargetAdjustment', () => {
  it('suggests a cut when losing slower than target', () => {
    const s = suggestTargetAdjustment(base)
    expect(s.suggest).toBe(true)
    expect(s.newBase).toBeLessThan(1500)
    expect(s.newBase).toBeGreaterThanOrEqual(1400)     // floor
    expect(1500 - s.newBase!).toBeLessThanOrEqual(250) // max step
  })
  it('stays quiet when on track', () => {
    expect(suggestTargetAdjustment({ ...base, trendRatePerWeekKg: -0.5 }).suggest).toBe(false)
  })
  it('stays quiet when unreliable', () => {
    expect(suggestTargetAdjustment({ ...base, reliable: false }).suggest).toBe(false)
  })
  it('never pushes deficit past 750', () => {
    const s = suggestTargetAdjustment({ ...base, tdeeEstimate: 2000, currentDeficit: 700 })
    if (s.suggest) expect(s.newDeficit!).toBeLessThanOrEqual(750)
  })
})
