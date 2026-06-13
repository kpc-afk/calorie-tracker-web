'use client'
import { useEffect, useState } from 'react'
import {
  AreaChart, Area, ComposedChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { generateFoodCSV, downloadCSV } from '@/lib/utils/csv'
import { todayString } from '@/lib/utils/format'
import { useCachedFetch } from '@/lib/utils/useCachedFetch'
import { appCache } from '@/lib/utils/cache'
import { todayLondon, daysAgoLondon, isoWeekKey } from '@/lib/utils/dates'
import MicroLabel from '@/components/ui/MicroLabel'
import HairlineCard from '@/components/ui/HairlineCard'
import StatNumeral from '@/components/ui/StatNumeral'
import type { FoodEntry, UserProfile, DailyActivity } from '@/lib/db/types'

const GOAL_WEIGHT_KG = 72

type MacroAverages = {
  avgCalories: number; avgProtein: number; avgCarbs: number; avgFat: number; days: number
}
type ProgressData = {
  calorieTotals: { date: string; total: number }[]
  macroAverages: MacroAverages | null
  weightHistory: { date: string; weight_kg: number }[]
  activityHistory: DailyActivity[]
}
type AnalyticsData = {
  trend: { points: { date: string; trend: number }[]; raw: { date: string; weight_kg: number }[] }
  tdee: { tdee: number; reliable: boolean }
  eta: { etaDate: string | null; weeks: number | null }
  compliance: { weekKey: string; daysLogged: number; onBudgetDays: number; proteinHitDays: number; avgIntake: number; avgBudget: number }[]
  patterns: {
    topFoods: { name: string; count: number; avgKcal: number }[]
    budgetBlowers: { name: string; count: number; overRate: number }[]
  }
  weekdayWeekend: { weekday: number; weekend: number }
}

const tooltipStyle = {
  backgroundColor: 'var(--bg)', border: '1px solid var(--hairline)',
  borderRadius: 6, color: 'var(--ink)', fontSize: 12,
}

const axisTick = { fill: 'var(--muted)', fontSize: 10 }

function formatDate(iso: string) {
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

function heatColor(ratio: number | null): string {
  if (ratio === null) return 'transparent'
  if (ratio > 1.05) return `rgba(224,69,43,${Math.min(0.12 + (ratio - 1) * 0.6, 0.55)})`
  return `rgba(200,255,28,${Math.min(0.06 + ratio * 0.32, 0.38)})`
}

export default function ProgressPage() {
  const [view, setView] = useState<'charts' | 'table'>('charts')
  const [calDays, setCalDays] = useState(7)
  const [data, setData] = useState<ProgressData | null>(null)
  const [allEntries, setAllEntries] = useState<FoodEntry[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [logging, setLogging] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const { data: analytics, refresh: refreshAnalytics } = useCachedFetch<AnalyticsData>('/api/analytics')

  useEffect(() => {
    fetch(`/api/progress?days=${calDays}`).then(r => r.json()).then(setData)
    fetch('/api/profile').then(r => r.json()).then(setProfile)
  }, [calDays])

  useEffect(() => {
    if (view === 'table') {
      fetch('/api/entries/all').then(r => r.json()).then(setAllEntries)
      fetch('/api/progress?days=90').then(r => r.json()).then(setData)
    }
  }, [view])

  async function handleLogWeight() {
    const kg = parseFloat(weightInput)
    if (!kg || kg <= 0) return
    setLogging(true)
    await fetch('/api/weight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayString(), weight_kg: kg }),
    })
    setWeightInput('')
    setLogging(false)
    fetch(`/api/progress?days=${calDays}`).then(r => r.json()).then(setData)
    appCache.invalidatePrefix('/api/analytics')
    refreshAnalytics()
  }

  // Build per-day summaries for the table view
  const daySummaries = (() => {
    if (!allEntries.length && !data?.activityHistory?.length) return []

    // Group food entries by date
    const foodByDate: Record<string, FoodEntry[]> = {}
    for (const e of allEntries) {
      if (!foodByDate[e.date]) foodByDate[e.date] = []
      foodByDate[e.date].push(e)
    }

    // Index activity by date
    const actByDate: Record<string, DailyActivity> = {}
    for (const a of (data?.activityHistory ?? [])) {
      actByDate[a.date] = a
    }

    // Index weight by date, and build a sorted list for "latest before date" lookup
    const weightByDate: Record<string, number> = {}
    const weightSorted = [...(data?.weightHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date))
    for (const w of weightSorted) weightByDate[w.date] = w.weight_kg

    function latestWeightOn(date: string): number | null {
      // exact match first
      if (weightByDate[date]) return weightByDate[date]
      // find most recent entry before this date
      const prior = weightSorted.filter(w => w.date <= date)
      return prior.length > 0 ? prior[prior.length - 1].weight_kg : null
    }

    // Union of all dates
    const allDates = new Set([...Object.keys(foodByDate), ...Object.keys(actByDate)])
    const sorted = [...allDates].sort((a, b) => b.localeCompare(a)) // newest first

    return sorted.map(date => {
      const foods = foodByDate[date] ?? []
      const act = actByDate[date]
      const eaten = foods.reduce((s, f) => s + f.calories, 0)
      const protein = foods.reduce((s, f) => s + f.protein, 0)
      const carbs = foods.reduce((s, f) => s + f.carbs, 0)
      const fat = foods.reduce((s, f) => s + f.fat, 0)
      const stepsKcal = act?.steps_calories ?? 0
      const workoutKcal = act?.workout_calories ?? 0
      const stepsCount = act?.steps_count ?? 0
      const baseTarget = profile?.target_calories ?? 0
      const budget = baseTarget + stepsKcal + workoutKcal
      const deficit = budget - eaten
      const weight = latestWeightOn(date)
      return { date, foods, eaten, protein, carbs, fat, stepsKcal, workoutKcal, stepsCount, baseTarget, budget, deficit, weight }
    })
  })()

  // --- headline stats ---
  const latestTrend = analytics?.trend.points[analytics.trend.points.length - 1]
  const tdeeReliable = !!analytics?.tdee.reliable
  const etaDate = analytics?.eta.etaDate ?? null
  const hasTrendData = (analytics?.trend.points.length ?? 0) >= 2

  // --- weight chart data ---
  const weightChartData = (analytics?.trend.points ?? []).map(p => {
    const raw = analytics?.trend.raw.find(r => r.date === p.date)
    return { date: p.date, trend: p.trend, raw: raw?.weight_kg }
  })

  // --- compliance ---
  const thisWeekKey = isoWeekKey(todayLondon())
  const lastWeekKey = isoWeekKey(daysAgoLondon(7))
  function weekLabel(weekKey: string) {
    if (weekKey === thisWeekKey) return 'This week'
    if (weekKey === lastWeekKey) return 'Last week'
    return weekKey
  }
  const complianceWeeks = (analytics?.compliance ?? []).slice(-4)

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="font-display italic text-[26px] leading-none">Progress</div>
      </div>

      {/* View toggle */}
      <div className="px-5 flex gap-2 mb-5">
        {(['charts', 'table'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-2.5 rounded-[var(--radius)] text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors border ${
              view === v
                ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
                : 'border-[var(--hairline)] text-[var(--ink-60)]'
            }`}>
            {v}
          </button>
        ))}
      </div>

      {view === 'charts' && !data && !analytics && (
        <div className="px-5 space-y-4">
          {[72, 160, 140, 140, 140].map((h, i) => (
            <div key={i} className="border border-[var(--hairline)] rounded-[var(--radius)] animate-pulse" style={{ height: h }} />
          ))}
        </div>
      )}

      {view === 'charts' && (data || analytics) && (
        <div className="px-5 space-y-6">
          {/* 1. Headline stats row */}
          <div className="flex justify-between">
            <StatNumeral
              value={tdeeReliable ? analytics!.tdee.tdee : '—'}
              label={tdeeReliable ? 'Real TDEE' : 'Real TDEE · needs more data'}
              size="md"
              tone="accent"
            />
            <StatNumeral
              value={latestTrend ? latestTrend.trend.toFixed(1) : '—'}
              label={latestTrend ? 'Trend weight' : 'Trend weight · no data'}
              size="md"
              suffix={latestTrend ? 'kg' : undefined}
            />
            <StatNumeral
              value={etaDate ? formatDate(etaDate) : '—'}
              label={!hasTrendData ? 'Goal ETA · needs more data' : etaDate ? 'Goal ETA' : 'Goal ETA · trend flat'}
              size="md"
            />
          </div>

          {/* 2. Weight chart */}
          <div>
            <MicroLabel className="mb-3">Weight</MicroLabel>
            <HairlineCard className="p-3">
              {weightChartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={weightChartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <XAxis dataKey="date" tick={axisTick} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine y={GOAL_WEIGHT_KG} stroke="var(--hairline-strong)" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="raw" stroke="none" dot={{ r: 3, fill: 'var(--ink-60)' }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="trend" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-[13px] text-[var(--ink-60)] py-10 text-center">Log a few weigh-ins to see your trend</div>
              )}
            </HairlineCard>
          </div>

          {/* 3. Compliance strip */}
          <div>
            <MicroLabel className="mb-3">Weekly compliance</MicroLabel>
            <HairlineCard className="p-4">
              {complianceWeeks.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="micro-label">Week</span>
                    <div className="flex items-center gap-4">
                      <span className="micro-label">On budget</span>
                      <span className="micro-label">Protein</span>
                    </div>
                  </div>
                  {complianceWeeks.map(w => (
                    <div key={w.weekKey} className="flex items-center justify-between py-2 border-t border-[var(--hairline)] first:border-t-0">
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] text-[var(--ink)]">{weekLabel(w.weekKey)}</span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 7 }).map((_, i) => (
                            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < w.daysLogged ? 'bg-[var(--accent)]' : 'bg-[var(--hairline)]'}`} />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 tnum text-[13px] text-[var(--ink-60)]">
                        <span>{w.onBudgetDays}/7</span>
                        <span>{w.proteinHitDays}/7</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-[13px] text-[var(--ink-60)] py-2 text-center">Log a few days to see weekly compliance</div>
              )}
            </HairlineCard>
          </div>

          {/* 4. Calorie trend */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <MicroLabel>Calories</MicroLabel>
              <div className="flex gap-1.5">
                {[7, 30].map(d => (
                  <button key={d} onClick={() => setCalDays(d)}
                    className={`px-2.5 py-1 rounded-[var(--radius)] text-[11px] font-semibold tnum transition-colors border ${
                      calDays === d
                        ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
                        : 'border-[var(--hairline)] text-[var(--ink-60)]'
                    }`}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <HairlineCard className="p-3">
              {data && data.calorieTotals.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data.calorieTotals} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="calorieGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={axisTick} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={l => `Date: ${l}`} />
                    {profile && (
                      <ReferenceLine y={profile.target_calories} stroke="var(--hairline-strong)" strokeDasharray="4 2" />
                    )}
                    <Area type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2}
                      fill="url(#calorieGrad)" dot={false} name="kcal" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-[13px] text-[var(--ink-60)] py-10 text-center">No calorie data yet</div>
              )}
            </HairlineCard>
          </div>

          {/* 7-day macro averages */}
          {data?.macroAverages && data.macroAverages.days > 0 && (
            <div>
              <MicroLabel className="mb-3">7-day macro averages</MicroLabel>
              <HairlineCard className="p-3">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
                    data={[
                      { name: 'Protein', actual: data.macroAverages.avgProtein, target: profile?.protein_target_g ?? 0 },
                      { name: 'Carbs', actual: data.macroAverages.avgCarbs, target: profile?.carbs_target_g ?? 0 },
                      { name: 'Fat', actual: data.macroAverages.avgFat, target: profile?.fat_target_g ?? 0 },
                    ]}>
                    <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="actual" fill="var(--accent)" radius={[2,2,0,0]} name="actual (g)" />
                    <Bar dataKey="target" fill="var(--hairline-strong)" radius={[2,2,0,0]} name="target (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </HairlineCard>
            </div>
          )}

          {/* Day-of-week heatmap */}
          {data && data.calorieTotals.length >= 7 && profile && (() => {
            const budget = profile.target_calories
            const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            const buckets: { date: string; total: number }[][] = Array.from({ length: 7 }, () => [])
            data.calorieTotals.forEach(d => {
              const dow = (new Date(d.date + 'T12:00:00').getDay() + 6) % 7 // 0=Mon
              buckets[dow].push(d)
            })
            return (
              <div>
                <MicroLabel className="mb-3">Day-of-week patterns</MicroLabel>
                <HairlineCard className="p-3">
                  <div className="flex gap-1.5">
                    {DOW.map((day, i) => {
                      const entries = buckets[i]
                      const avg = entries.length > 0 ? entries.reduce((s, e) => s + e.total, 0) / entries.length : null
                      const overCount = entries.filter(e => e.total > budget).length
                      const ratio = avg !== null ? avg / budget : null
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                          <div className="w-full rounded-[var(--radius)] py-3 flex flex-col items-center justify-center border border-[var(--hairline)]"
                            style={{ backgroundColor: heatColor(ratio) }}>
                            <span className="font-display tnum text-[13px] text-[var(--ink)]">{avg !== null ? Math.round(avg) : '—'}</span>
                          </div>
                          <MicroLabel>{day}</MicroLabel>
                          {overCount > 0 && <span className="tnum text-[11px] text-[var(--danger)]">{overCount}×</span>}
                        </div>
                      )
                    })}
                  </div>
                </HairlineCard>
              </div>
            )
          })()}

          {/* 5. Patterns */}
          <div className="space-y-4">
            <div>
              <MicroLabel className="mb-3">Most logged</MicroLabel>
              <HairlineCard className="p-4">
                {analytics && analytics.patterns.topFoods.length > 0 ? (
                  analytics.patterns.topFoods.slice(0, 5).map((f, i) => (
                    <div key={f.name} className={`flex items-center justify-between py-2 ${i > 0 ? 'border-t border-[var(--hairline)]' : ''}`}>
                      <span className="text-[13px] text-[var(--ink)] truncate pr-3">{f.name}</span>
                      <div className="flex items-center gap-3 shrink-0 tnum text-[13px] text-[var(--ink-60)]">
                        <span>×{f.count}</span>
                        <span>{f.avgKcal} kcal</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[13px] text-[var(--ink-60)] py-2 text-center">Log more meals to see your patterns</div>
                )}
              </HairlineCard>
            </div>

            <div>
              <MicroLabel className="mb-3">Budget blowers</MicroLabel>
              <HairlineCard className="p-4">
                {analytics && analytics.patterns.budgetBlowers.length > 0 ? (
                  analytics.patterns.budgetBlowers.map((f, i) => (
                    <div key={f.name} className={`flex items-center justify-between py-2 ${i > 0 ? 'border-t border-[var(--hairline)]' : ''}`}>
                      <span className="text-[13px] text-[var(--ink)] truncate pr-3">{f.name}</span>
                      <span className="tnum text-[13px] text-[var(--danger)] shrink-0">{Math.round(f.overRate * 100)}% over budget</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[13px] text-[var(--ink-60)] py-2 text-center">No recurring budget-blowers yet</div>
                )}
              </HairlineCard>
            </div>

            <div className="flex justify-between">
              <StatNumeral value={analytics?.weekdayWeekend.weekday ?? '—'} label="Weekday avg" size="md" suffix={analytics ? 'kcal' : undefined} />
              <StatNumeral value={analytics?.weekdayWeekend.weekend ?? '—'} label="Weekend avg" size="md" suffix={analytics ? 'kcal' : undefined} />
            </div>
          </div>

          {/* Log weight */}
          <div>
            <MicroLabel className="mb-3">Log today&apos;s weight</MicroLabel>
            <HairlineCard className="p-4">
              <div className="flex gap-2">
                <input type="number" inputMode="decimal" value={weightInput} onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogWeight()}
                  placeholder="e.g. 75.5 (kg)"
                  className="flex-1 bg-transparent border-b border-[var(--hairline)] pb-2 text-[15px] tnum text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--hairline-strong)]" />
                <button onClick={handleLogWeight} disabled={logging || !weightInput}
                  className="px-5 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-ink)] text-[13px] font-semibold disabled:opacity-40">
                  {logging ? '…' : 'Log'}
                </button>
              </div>
            </HairlineCard>
          </div>
        </div>
      )}

      {view === 'table' && (
        <div className="px-5 space-y-3">
          <button
            onClick={() => downloadCSV(generateFoodCSV(allEntries), `calories-${todayString()}.csv`)}
            className="w-full border border-[var(--hairline)] rounded-[var(--radius)] py-3 text-[13px] font-medium text-[var(--ink)] hover:border-[var(--hairline-strong)] transition-colors">
            Export CSV ↓
          </button>

          {daySummaries.length === 0
            ? <div className="text-center text-[var(--ink-60)] py-10 text-[13px]">No entries yet</div>
            : daySummaries.map(day => {
              const expanded = expandedDays.has(day.date)
              const deficitColor = day.deficit >= 0 ? 'text-[var(--accent)]' : 'text-[var(--danger)]'
              const deficitLabel = day.deficit >= 0 ? `−${Math.round(day.deficit)}` : `+${Math.round(Math.abs(day.deficit))}`

              return (
                <HairlineCard key={day.date} className="overflow-hidden">
                  {/* Day header */}
                  <button
                    onClick={() => setExpandedDays(prev => {
                      const next = new Set(prev)
                      next.has(day.date) ? next.delete(day.date) : next.add(day.date)
                      return next
                    })}
                    className="w-full p-4 text-left">
                    {/* Row 1: date + weight + deficit */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-[18px] leading-none">{formatDate(day.date)}</span>
                        {day.weight && (
                          <span className="tnum text-[12px] text-[var(--ink-60)]">{day.weight.toFixed(1)} kg</span>
                        )}
                      </div>
                      <span className={`tnum text-[13px] font-medium ${deficitColor}`}>
                        {deficitLabel} kcal
                      </span>
                    </div>

                    {/* Row 2: eaten vs budget bar */}
                    <div className="mb-2.5">
                      <div className="flex justify-between text-[11px] mb-1 text-[var(--ink-60)]">
                        <span>Eaten <span className="tnum text-[var(--ink)]">{Math.round(day.eaten)}</span></span>
                        <span>Budget <span className="tnum text-[var(--ink)]">{Math.round(day.budget)}</span></span>
                      </div>
                      <div className="h-1 bg-[var(--hairline)] rounded-[var(--radius)] overflow-hidden">
                        <div className="h-full"
                          style={{
                            width: `${Math.min((day.eaten / Math.max(day.budget, 1)) * 100, 100)}%`,
                            backgroundColor: day.eaten > day.budget ? 'var(--danger)' : 'var(--accent)',
                          }} />
                      </div>
                    </div>

                    {/* Row 3: macros + activity */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)] tnum">
                      <span>P {Math.round(day.protein)}g</span>
                      <span>C {Math.round(day.carbs)}g</span>
                      <span>F {Math.round(day.fat)}g</span>
                      {day.stepsKcal > 0 && <span>Steps +{Math.round(day.stepsKcal)}</span>}
                      {day.workoutKcal > 0 && <span>Workout +{Math.round(day.workoutKcal)}</span>}
                    </div>
                  </button>

                  {/* Budget breakdown */}
                  {(day.stepsKcal > 0 || day.workoutKcal > 0) && !expanded && (
                    <div className="px-4 pb-3 -mt-1">
                      <div className="text-[11px] text-[var(--muted)] tnum">
                        Budget: {Math.round(day.baseTarget)} base
                        {day.stepsKcal > 0 && ` + ${Math.round(day.stepsKcal)} steps`}
                        {day.workoutKcal > 0 && ` + ${Math.round(day.workoutKcal)} workout`}
                        {' '}= {Math.round(day.budget)}
                      </div>
                    </div>
                  )}

                  {/* Expanded: food items */}
                  {expanded && day.foods.length > 0 && (
                    <div className="border-t border-[var(--hairline)]">
                      {(day.stepsKcal > 0 || day.workoutKcal > 0) && (
                        <div className="px-4 py-2.5 text-[11px] text-[var(--muted)] tnum border-b border-[var(--hairline)]">
                          Budget: {Math.round(day.baseTarget)} base
                          {day.stepsKcal > 0 && ` + ${Math.round(day.stepsKcal)} steps`}
                          {day.workoutKcal > 0 && ` + ${Math.round(day.workoutKcal)} workout`}
                          {' '}= {Math.round(day.budget)} kcal
                        </div>
                      )}
                      {day.foods.map((f, i) => (
                        <div key={f.id} className={`flex items-center justify-between px-4 py-2.5 text-[11px] ${i < day.foods.length - 1 ? 'border-b border-[var(--hairline)]' : ''}`}>
                          <span className="text-[var(--ink-60)] flex-1 min-w-0 truncate pr-3">{f.name}</span>
                          <div className="flex gap-3 shrink-0 tnum text-[var(--muted)]">
                            <span className="text-[var(--accent)] font-medium">{Math.round(f.calories)}</span>
                            <span>P{Math.round(f.protein)}</span>
                            <span>C{Math.round(f.carbs)}</span>
                            <span>F{Math.round(f.fat)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </HairlineCard>
              )
            })
          }
        </div>
      )}
    </div>
  )
}
