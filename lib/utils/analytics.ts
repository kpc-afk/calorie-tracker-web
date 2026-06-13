import { addDays } from './dates'

export function ewmaTrend(weights: { date: string; weight_kg: number }[], alpha = 0.2): { date: string; trend: number }[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const out: { date: string; trend: number }[] = []
  let prev: number | null = null
  for (const w of sorted) {
    prev = prev === null ? w.weight_kg : alpha * w.weight_kg + (1 - alpha) * prev
    out.push({ date: w.date, trend: Math.round(prev * 100) / 100 })
  }
  return out
}

const KCAL_PER_KG = 7700

export function backCalcTdee(p: { avgIntake: number; trendDeltaKg: number; windowDays: number; loggedDays: number; weighIns: number }) {
  const tdee = Math.round(p.avgIntake + (-p.trendDeltaKg * KCAL_PER_KG) / p.windowDays)
  const reliable = p.loggedDays >= 10 && p.weighIns >= 2 && p.windowDays >= 14
  return { tdee, reliable }
}

export function goalEta(p: { currentTrendKg: number; goalKg: number; ratePerWeekKg: number; today: string }) {
  const toLose = p.currentTrendKg - p.goalKg
  if (toLose <= 0) return { etaDate: p.today, weeks: 0 }
  if (p.ratePerWeekKg >= -0.05) return { etaDate: null, weeks: null } // flat or gaining
  const weeks = toLose / -p.ratePerWeekKg
  return { etaDate: addDays(p.today, Math.round(weeks * 7)), weeks: Math.round(weeks * 10) / 10 }
}

type PatternEntry = { date: string; name: string; calories: number }

export function foodPatterns(entries: PatternEntry[], overBudgetDates: Set<string>, minCount = 3) {
  const byName = new Map<string, { count: number; totalKcal: number; dates: Set<string> }>()
  for (const e of entries) {
    const key = e.name.trim()
    const rec = byName.get(key) ?? { count: 0, totalKcal: 0, dates: new Set<string>() }
    rec.count++; rec.totalKcal += e.calories; rec.dates.add(e.date)
    byName.set(key, rec)
  }
  const topFoods = [...byName.entries()]
    .map(([name, r]) => ({ name, count: r.count, avgKcal: Math.round(r.totalKcal / r.count) }))
    .sort((a, b) => b.count - a.count).slice(0, 10)
  const budgetBlowers = [...byName.entries()]
    .filter(([, r]) => r.count >= minCount)
    .map(([name, r]) => {
      const overDays = [...r.dates].filter(d => overBudgetDates.has(d)).length
      return { name, count: r.count, overRate: overDays / r.dates.size }
    })
    .filter(f => f.overRate >= 0.5)
    .sort((a, b) => b.overRate - a.overRate).slice(0, 5)
  return { topFoods, budgetBlowers }
}
