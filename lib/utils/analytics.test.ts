import { describe, it, expect } from 'vitest'
import { ewmaTrend, backCalcTdee, goalEta, foodPatterns } from './analytics'

const w = (date: string, kg: number) => ({ date, weight_kg: kg })

describe('ewmaTrend', () => {
  it('smooths toward new values', () => {
    const t = ewmaTrend([w('2026-06-01', 84), w('2026-06-02', 83)], 0.5)
    expect(t[0].trend).toBe(84)
    expect(t[1].trend).toBeCloseTo(83.5)
  })
})

describe('backCalcTdee', () => {
  it('computes TDEE from intake + trend delta', () => {
    // 21 days, avg 1600 kcal, trend fell 1.5kg → tdee ≈ 1600 + 1.5*7700/21 = 2150
    const r = backCalcTdee({ avgIntake: 1600, trendDeltaKg: -1.5, windowDays: 21, loggedDays: 18, weighIns: 8 })
    expect(r.tdee).toBe(2150)
    expect(r.reliable).toBe(true)
  })
  it('flags unreliable with sparse data', () => {
    const r = backCalcTdee({ avgIntake: 1600, trendDeltaKg: -0.5, windowDays: 21, loggedDays: 6, weighIns: 1 })
    expect(r.reliable).toBe(false)
  })
})

describe('goalEta', () => {
  it('projects a date when trending down', () => {
    const r = goalEta({ currentTrendKg: 80, goalKg: 72, ratePerWeekKg: -0.5, today: '2026-06-12' })
    expect(r.etaDate).toBe('2026-10-02') // 16 weeks out
  })
  it('returns null when flat or gaining', () => {
    expect(goalEta({ currentTrendKg: 80, goalKg: 72, ratePerWeekKg: 0.1, today: '2026-06-12' }).etaDate).toBeNull()
  })
})

describe('foodPatterns', () => {
  it('ranks top foods and budget-blowers', () => {
    const entries = [
      { date: '2026-06-01', name: 'Porridge', calories: 300 },
      { date: '2026-06-01', name: 'Beer', calories: 400 },
      { date: '2026-06-02', name: 'Porridge', calories: 300 },
      { date: '2026-06-03', name: 'Beer', calories: 400 },
      { date: '2026-06-04', name: 'Beer', calories: 400 },
    ]
    const overDates = new Set(['2026-06-01', '2026-06-03', '2026-06-04'])
    const p = foodPatterns(entries, overDates, 2)
    expect(p.topFoods[0]).toMatchObject({ name: 'Beer', count: 3 })
    expect(p.budgetBlowers[0].name).toBe('Beer') // present on 3/3 over days
  })
})
