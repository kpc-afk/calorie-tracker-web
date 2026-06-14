import { describe, it, expect } from 'vitest'
import { todayLondon, addDays, isoWeekKey, daysAgoLondon } from './dates'

describe('dates', () => {
  it('todayLondon returns YYYY-MM-DD', () => {
    expect(todayLondon()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('addDays does pure string date math', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31')
  })
  it('isoWeekKey computes ISO week', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01')
    expect(isoWeekKey('2026-06-12')).toBe('2026-W24')
  })
  it('daysAgoLondon offsets from today', () => {
    expect(daysAgoLondon(0)).toBe(todayLondon())
  })
})
