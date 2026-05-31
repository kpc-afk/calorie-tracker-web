'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'
import { generateFoodCSV, downloadCSV } from '@/lib/utils/csv'
import { todayString } from '@/lib/utils/format'
import type { FoodEntry, UserProfile } from '@/lib/db/types'

type MacroAverages = {
  avgCalories: number; avgProtein: number; avgCarbs: number; avgFat: number; days: number
}
type ProgressData = {
  calorieTotals: { date: string; total: number }[]
  macroAverages: MacroAverages | null
  weightHistory: { date: string; weight_kg: number }[]
}

const tooltipStyle = {
  backgroundColor: '#1c1c1e', border: '1px solid #3a3a3c',
  borderRadius: 8, color: '#fff', fontSize: 12,
}

export default function ProgressPage() {
  const [view, setView] = useState<'charts' | 'table'>('charts')
  const [calDays, setCalDays] = useState(7)
  const [data, setData] = useState<ProgressData | null>(null)
  const [allEntries, setAllEntries] = useState<FoodEntry[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    fetch(`/api/progress?days=${calDays}`).then(r => r.json()).then(setData)
    fetch('/api/profile').then(r => r.json()).then(setProfile)
  }, [calDays])

  useEffect(() => {
    if (view === 'table') {
      fetch('/api/entries/all').then(r => r.json()).then(setAllEntries)
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
                <LineChart data={data.calorieTotals} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fill: '#8e8e93', fontSize: 10 }}
                    tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: '#8e8e93', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={l => `Date: ${l}`} />
                  <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} dot={false} name="kcal" />
                  {profile && (
                    <Line type="monotone" dataKey={() => profile.target_calories}
                      stroke="#3a3a3c" strokeWidth={1} strokeDasharray="4 2" dot={false} name="target" />
                  )}
                </LineChart>
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

          {/* Weight trend */}
          {data.weightHistory.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-3">Weight</h3>
              <div className="bg-zinc-900 rounded-2xl p-3">
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={data.weightHistory} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <XAxis dataKey="date" tick={{ fill: '#8e8e93', fontSize: 10 }}
                      tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fill: '#8e8e93', fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="weight_kg" stroke="#3b82f6" strokeWidth={2}
                      dot={{ r: 3, fill: '#3b82f6' }} name="kg" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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
            onClick={() => downloadCSV(
              generateFoodCSV(allEntries),
              `calories-${todayString()}.csv`
            )}
            className="w-full bg-zinc-900 text-white py-3 rounded-xl text-sm font-medium border border-zinc-800 hover:border-zinc-600 transition-colors">
            Export CSV ↓
          </button>
          {allEntries.length === 0
            ? <div className="text-center text-gray-600 py-10 text-sm">No entries yet</div>
            : (
              <div className="bg-zinc-900 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-zinc-800">
                        <th className="py-2.5 px-3 text-left font-medium">Date</th>
                        <th className="py-2.5 px-3 text-left font-medium">Food</th>
                        <th className="py-2.5 px-3 text-right font-medium">kcal</th>
                        <th className="py-2.5 px-3 text-right font-medium">P</th>
                        <th className="py-2.5 px-3 text-right font-medium">C</th>
                        <th className="py-2.5 px-3 text-right font-medium">F</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allEntries.map(e => (
                        <tr key={e.id} className="border-b border-zinc-800 last:border-0">
                          <td className="py-2 px-3 text-gray-500">{e.date.slice(5)}</td>
                          <td className="py-2 px-3 text-gray-300 max-w-[130px] truncate">{e.name}</td>
                          <td className="py-2 px-3 text-right text-green-400 font-medium">{Math.round(e.calories)}</td>
                          <td className="py-2 px-3 text-right text-gray-400">{Math.round(e.protein)}</td>
                          <td className="py-2 px-3 text-right text-gray-400">{Math.round(e.carbs)}</td>
                          <td className="py-2 px-3 text-right text-gray-400">{Math.round(e.fat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
