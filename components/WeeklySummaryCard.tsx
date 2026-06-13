'use client'
import { useState, useEffect } from 'react'
import HairlineCard from './ui/HairlineCard'
import MicroLabel from './ui/MicroLabel'

type SummaryData = {
  summary: string
  stats: {
    avgCalories: number
    proteinHitDays: number
    onBudgetDays: number
    daysLogged: number
    weightChange: number | null
    avgBudget: number
  }
  weekStart: string
}

const CACHE_KEY = 'weekly_summary_v1'

export default function WeeklySummaryCard() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const today = new Date()
    if (today.getDay() !== 0) return // only Sunday

    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as SummaryData & { cachedDate: string }
        const thisMonday = new Date(today)
        thisMonday.setDate(today.getDate() - 6)
        const thisMondayStr = thisMonday.toISOString().split('T')[0]
        if (parsed.weekStart === thisMondayStr) {
          setData(parsed)
          return
        }
      }
    } catch { /* ignore */ }

    setLoading(true)
    fetch('/api/weekly-summary')
      .then(r => r.json())
      .then((d: SummaryData) => {
        if (d.summary) {
          setData(d)
          localStorage.setItem(CACHE_KEY, JSON.stringify(d))
        }
      })
      .catch(() => { /* fail silently */ })
      .finally(() => setLoading(false))
  }, [])

  if (dismissed || (!data && !loading)) return null

  return (
    <HairlineCard className="mx-3 mt-2 mb-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <MicroLabel>Weekly recap</MicroLabel>
        <button onClick={() => setDismissed(true)} className="text-[var(--ink-60)] hover:text-[var(--ink)] text-lg leading-none transition-colors">×</button>
      </div>

      {loading ? (
        <div className="text-[var(--ink-60)] text-[13px]">Generating your weekly summary…</div>
      ) : data ? (
        <>
          <p className="text-[var(--ink-60)] text-[13px] leading-relaxed mb-3">{data.summary}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="border border-[var(--hairline)] rounded-[var(--radius)] p-2 text-center">
              <div className="font-display tnum text-[var(--ink)] text-base">{data.stats.daysLogged}/7</div>
              <MicroLabel className="mt-1">Days logged</MicroLabel>
            </div>
            <div className="border border-[var(--hairline)] rounded-[var(--radius)] p-2 text-center">
              <div className="font-display tnum text-[var(--ink)] text-base">{data.stats.onBudgetDays}/7</div>
              <MicroLabel className="mt-1">On budget</MicroLabel>
            </div>
            <div className="border border-[var(--hairline)] rounded-[var(--radius)] p-2 text-center">
              <div className="font-display tnum text-[var(--ink)] text-base">{data.stats.proteinHitDays}/7</div>
              <MicroLabel className="mt-1">Protein hit</MicroLabel>
            </div>
          </div>
          {data.stats.weightChange !== null && (
            <div className={`mt-3 text-[13px] tnum text-center ${data.stats.weightChange < 0 ? 'text-[var(--accent)]' : data.stats.weightChange > 0 ? 'text-[var(--danger)]' : 'text-[var(--ink-60)]'}`}>
              {data.stats.weightChange < 0 ? '↓' : data.stats.weightChange > 0 ? '↑' : '→'}{' '}
              {Math.abs(data.stats.weightChange).toFixed(1)} kg this week
            </div>
          )}
        </>
      ) : null}
    </HairlineCard>
  )
}
