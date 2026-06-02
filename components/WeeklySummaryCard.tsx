'use client'
import { useState, useEffect } from 'react'

type SummaryData = {
  summary: string
  stats: {
    avgCalories: number
    proteinHitDays: number
    onBudgetDays: number
    daysLogged: number
    weightChange: number | null
    budget: number
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
    <div className="mx-3 mt-2 mb-1 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-white font-bold text-sm">Weekly Recap</span>
        </div>
        <button onClick={() => setDismissed(true)} className="text-zinc-600 hover:text-zinc-400 text-lg leading-none">×</button>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-xs">Generating your weekly summary…</div>
      ) : data ? (
        <>
          <p className="text-zinc-300 text-sm leading-relaxed mb-3">{data.summary}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <div className="text-white font-bold text-base">{data.stats.daysLogged}/7</div>
              <div className="text-zinc-500 text-xs">days logged</div>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <div className="text-white font-bold text-base">{data.stats.onBudgetDays}/7</div>
              <div className="text-zinc-500 text-xs">on budget</div>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-2 text-center">
              <div className="text-white font-bold text-base">{data.stats.proteinHitDays}/7</div>
              <div className="text-zinc-500 text-xs">protein hit</div>
            </div>
          </div>
          {data.stats.weightChange !== null && (
            <div className={`mt-2 text-xs font-semibold text-center ${data.stats.weightChange < 0 ? 'text-green-400' : data.stats.weightChange > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              {data.stats.weightChange < 0 ? '↓' : data.stats.weightChange > 0 ? '↑' : '→'}{' '}
              {Math.abs(data.stats.weightChange).toFixed(1)} kg this week
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
