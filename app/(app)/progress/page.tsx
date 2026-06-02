'use client'
import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine
} from 'recharts'
import { generateFoodCSV, downloadCSV } from '@/lib/utils/csv'
import { todayString } from '@/lib/utils/format'
import type { FoodEntry, UserProfile, DailyActivity } from '@/lib/db/types'

type MacroAverages = {
  avgCalories: number; avgProtein: number; avgCarbs: number; avgFat: number; days: number
}
type ProgressData = {
  calorieTotals: { date: string; total: number }[]
  macroAverages: MacroAverages | null
  weightHistory: { date: string; weight_kg: number }[]
  activityHistory: DailyActivity[]
}

const tooltipStyle = {
  backgroundColor: '#1c1c1e', border: '1px solid #3a3a3c',
  borderRadius: 8, color: '#fff', fontSize: 12,
}

function formatDate(iso: string) {
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
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

  return (
    <div className="p-4 pb-6 space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        {(['charts', 'table'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-colors ${view === v ? 'bg-green-500 text-black' : 'bg-zinc-900 text-white border border-zinc-800'}`}>
            {v}
          </button>
        ))}
      </div>

      {view === 'charts' && !data && (
        <div className="space-y-6">
          {[160, 140, 140].map((h, i) => (
            <div key={i} className="bg-zinc-900 rounded-2xl p-3 animate-pulse" style={{ height: h }} />
          ))}
        </div>
      )}

      {view === 'charts' && data && (
        <div className="space-y-6">
          {/* Calorie trend */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold text-sm">Calories</h3>
              <div className="flex gap-1.5">
                {[7, 30].map(d => (
                  <button key={d} onClick={() => setCalDays(d)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${calDays === d ? 'bg-green-500 text-black' : 'bg-zinc-800 text-gray-400'}`}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-3">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data.calorieTotals} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="calorieGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#8e8e93', fontSize: 10 }}
                    tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: '#8e8e93', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={l => `Date: ${l}`} />
                  {profile && (
                    <ReferenceLine y={profile.target_calories} stroke="#3a3a3c" strokeDasharray="4 2" />
                  )}
                  <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2}
                    fill="url(#calorieGrad)" dot={false} name="kcal" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 7-day macro averages */}
          {data.macroAverages && data.macroAverages.days > 0 && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-3">7-day macro averages</h3>
              <div className="bg-zinc-900 rounded-2xl p-3">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
                    data={[
                      { name: 'Protein', actual: data.macroAverages.avgProtein, target: profile?.protein_target_g ?? 0 },
                      { name: 'Carbs', actual: data.macroAverages.avgCarbs, target: profile?.carbs_target_g ?? 0 },
                      { name: 'Fat', actual: data.macroAverages.avgFat, target: profile?.fat_target_g ?? 0 },
                    ]}>
                    <XAxis dataKey="name" tick={{ fill: '#8e8e93', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8e8e93', fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="actual" fill="#22c55e" radius={[4,4,0,0]} name="actual (g)" />
                    <Bar dataKey="target" fill="#3a3a3c" radius={[4,4,0,0]} name="target (g)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Day-of-week heatmap */}
          {data.calorieTotals.length >= 7 && profile && (() => {
            const budget = profile.target_calories
            const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            const buckets: { date: string; total: number }[][] = Array.from({ length: 7 }, () => [])
            data.calorieTotals.forEach(d => {
              const dow = (new Date(d.date + 'T12:00:00').getDay() + 6) % 7 // 0=Mon
              buckets[dow].push(d)
            })
            return (
              <div>
                <h3 className="text-white font-semibold text-sm mb-3">Day-of-week patterns</h3>
                <div className="bg-zinc-900 rounded-2xl p-3">
                  <div className="flex gap-1.5">
                    {DOW.map((day, i) => {
                      const entries = buckets[i]
                      const avg = entries.length > 0 ? entries.reduce((s, e) => s + e.total, 0) / entries.length : null
                      const overCount = entries.filter(e => e.total > budget).length
                      const ratio = avg !== null ? avg / budget : null
                      const bg = ratio === null ? 'bg-zinc-800'
                        : ratio > 1.05 ? 'bg-red-500/60'
                        : ratio > 0.95 ? 'bg-green-500/60'
                        : ratio > 0.5 ? 'bg-green-500/30'
                        : 'bg-zinc-700'
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full rounded-lg py-3 flex flex-col items-center justify-center ${bg}`}>
                            <span className="text-white font-bold text-xs">{avg !== null ? Math.round(avg) : '–'}</span>
                          </div>
                          <span className="text-zinc-500 text-xs">{day}</span>
                          {overCount > 0 && <span className="text-red-400 text-xs">{overCount}×</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-2.5 justify-end">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500/60" /><span className="text-zinc-500 text-xs">on budget</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500/60" /><span className="text-zinc-500 text-xs">over</span></div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Weight trend */}
          {data.weightHistory.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-3">Weight</h3>
              <div className="bg-zinc-900 rounded-2xl p-3">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={data.weightHistory} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: '#8e8e93', fontSize: 10 }}
                      tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fill: '#8e8e93', fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="weight_kg" stroke="#3b82f6" strokeWidth={2}
                      fill="url(#weightGrad)" dot={{ r: 3, fill: '#3b82f6' }} name="kg" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Weight projection */}
          {profile && profile.goal === 'lose' && data.weightHistory.length >= 3 && (() => {
            const wh = [...data.weightHistory].sort((a, b) => a.date.localeCompare(b.date))
            const recent = wh.slice(-14)
            const days = recent.length
            const kgChange = recent[days - 1].weight_kg - recent[0].weight_kg
            const weeklyRate = days > 1 ? (kgChange / (days - 1)) * 7 : 0
            const currentWeight = recent[days - 1].weight_kg
            const goalWeight = profile.weight_kg * 0.9
            const remaining = currentWeight - goalWeight
            if (weeklyRate >= 0 || remaining <= 0) return null
            const weeksNeeded = Math.round(remaining / Math.abs(weeklyRate))
            const targetDate = new Date()
            targetDate.setDate(targetDate.getDate() + weeksNeeded * 7)
            const targetStr = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <div key="projection" className="bg-zinc-900 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">🎯</span>
                  <h3 className="text-white font-semibold text-sm">Weight Projection</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  At your current pace of{' '}
                  <span className="text-green-400 font-semibold">{Math.abs(weeklyRate).toFixed(2)} kg/week</span>,
                  you could reach{' '}
                  <span className="text-white font-semibold">{goalWeight.toFixed(1)} kg</span> in ~{weeksNeeded} week{weeksNeeded !== 1 ? 's' : ''}
                  {weeksNeeded <= 52 && <> (around <span className="text-blue-400 font-semibold">{targetStr}</span>)</>}.
                </p>
              </div>
            )
          })()}

          {/* Log weight */}
          <div className="bg-zinc-900 rounded-2xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Log today&apos;s weight</h3>
            <div className="flex gap-2">
              <input type="number" value={weightInput} onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogWeight()}
                placeholder="e.g. 75.5 (kg)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500" />
              <button onClick={handleLogWeight} disabled={logging || !weightInput}
                className="bg-green-500 text-black font-semibold px-5 rounded-xl text-sm disabled:opacity-40">
                {logging ? '…' : 'Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'table' && (
        <div className="space-y-3">
          <button
            onClick={() => downloadCSV(generateFoodCSV(allEntries), `calories-${todayString()}.csv`)}
            className="w-full bg-zinc-900 text-white py-3 rounded-xl text-sm font-medium border border-zinc-800 hover:border-zinc-600 transition-colors">
            Export CSV ↓
          </button>

          {daySummaries.length === 0
            ? <div className="text-center text-gray-600 py-10 text-sm">No entries yet</div>
            : daySummaries.map(day => {
              const expanded = expandedDays.has(day.date)
              const deficitColor = day.deficit >= 0 ? 'text-green-400' : 'text-red-400'
              const deficitLabel = day.deficit >= 0 ? `−${Math.round(day.deficit)}` : `+${Math.round(Math.abs(day.deficit))}`

              return (
                <div key={day.date} className="bg-zinc-900 rounded-2xl overflow-hidden">
                  {/* Day header */}
                  <button
                    onClick={() => setExpandedDays(prev => {
                      const next = new Set(prev)
                      next.has(day.date) ? next.delete(day.date) : next.add(day.date)
                      return next
                    })}
                    className="w-full p-4 text-left">
                    {/* Row 1: date + weight + deficit badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-white font-semibold text-sm">{formatDate(day.date)}</span>
                        {day.weight && (
                          <span className="ml-2 text-blue-400 text-xs font-medium">{day.weight.toFixed(1)} kg</span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${day.deficit >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {deficitLabel} kcal
                      </span>
                    </div>

                    {/* Row 2: eaten vs budget bar */}
                    <div className="mb-2.5">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Eaten <span className="text-white font-medium">{Math.round(day.eaten)}</span></span>
                        <span className="text-gray-400">Budget <span className="text-white font-medium">{Math.round(day.budget)}</span></span>
                      </div>
                      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((day.eaten / Math.max(day.budget, 1)) * 100, 100)}%`,
                            backgroundColor: day.eaten > day.budget ? '#ef4444' : '#22c55e',
                          }} />
                      </div>
                    </div>

                    {/* Row 3: macros + activity */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>P <span className="text-gray-300">{Math.round(day.protein)}g</span></span>
                      <span>C <span className="text-gray-300">{Math.round(day.carbs)}g</span></span>
                      <span>F <span className="text-gray-300">{Math.round(day.fat)}g</span></span>
                      {day.stepsKcal > 0 && (
                        <span className="text-amber-500/80">⚡ Steps <span className="text-amber-400">+{Math.round(day.stepsKcal)}</span></span>
                      )}
                      {day.workoutKcal > 0 && (
                        <span className="text-purple-500/80">🏃 Workout <span className="text-purple-400">+{Math.round(day.workoutKcal)}</span></span>
                      )}
                    </div>
                  </button>

                  {/* Budget breakdown */}
                  {(day.stepsKcal > 0 || day.workoutKcal > 0) && !expanded && (
                    <div className="px-4 pb-3 -mt-1">
                      <div className="text-xs text-gray-600">
                        Budget: {Math.round(day.baseTarget)} base
                        {day.stepsKcal > 0 && ` + ${Math.round(day.stepsKcal)} steps`}
                        {day.workoutKcal > 0 && ` + ${Math.round(day.workoutKcal)} workout`}
                        {' '}= {Math.round(day.budget)}
                      </div>
                    </div>
                  )}

                  {/* Expanded: food items */}
                  {expanded && day.foods.length > 0 && (
                    <div className="border-t border-zinc-800">
                      {(day.stepsKcal > 0 || day.workoutKcal > 0) && (
                        <div className="px-4 py-2.5 text-xs text-gray-600 border-b border-zinc-800">
                          Budget: {Math.round(day.baseTarget)} base
                          {day.stepsKcal > 0 && ` + ${Math.round(day.stepsKcal)} steps`}
                          {day.workoutKcal > 0 && ` + ${Math.round(day.workoutKcal)} workout`}
                          {' '}= {Math.round(day.budget)} kcal
                        </div>
                      )}
                      {day.foods.map((f, i) => (
                        <div key={f.id} className={`flex items-center justify-between px-4 py-2.5 text-xs ${i < day.foods.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                          <span className="text-gray-300 flex-1 min-w-0 truncate pr-3">{f.name}</span>
                          <div className="flex gap-3 shrink-0 text-gray-500">
                            <span className="text-green-400 font-medium">{Math.round(f.calories)}</span>
                            <span>P{Math.round(f.protein)}</span>
                            <span>C{Math.round(f.carbs)}</span>
                            <span>F{Math.round(f.fat)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}
    </div>
  )
}
