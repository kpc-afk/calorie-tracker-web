'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import CalorieRing from '@/components/CalorieRing'
import MacroBar from '@/components/MacroBar'
import FoodCard from '@/components/FoodCard'
import ActivityStrip from '@/components/ActivityStrip'
import WeightSparkline from '@/components/WeightSparkline'
import WaterTracker from '@/components/WaterTracker'
import { getDailyBudget } from '@/lib/utils/calories'
import { formatDisplayDate, todayString, offsetDate } from '@/lib/utils/format'
import { haptic } from '@/lib/utils/haptic'
import type { FoodEntry, UserProfile, DailyActivity, WeightEntry } from '@/lib/db/types'

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [activity, setActivity] = useState<DailyActivity | null>(null)
  const [viewDate, setViewDate] = useState(todayString())
  const [streak, setStreak] = useState(0)
  const [recentWeights, setRecentWeights] = useState<WeightEntry[]>([])
  const [waterMl, setWaterMl] = useState(0)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualForm, setManualForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', serving_size: '1', serving_unit: 'serving' })
  const [manualSaving, setManualSaving] = useState(false)
  const celebratedRef = useRef(false)
  const today = todayString()

  const loadData = useCallback(async (date: string) => {
    const [pRes, eRes, aRes] = await Promise.all([
      fetch('/api/profile'),
      fetch(`/api/entries?date=${date}`),
      fetch(`/api/activity?date=${date}`),
    ])
    const [p, e, a] = await Promise.all([pRes.json(), eRes.json(), aRes.json()])
    setProfile(p)
    setEntries(e ?? [])
    setActivity(a)
    setWaterMl(a?.water_ml ?? 0)
  }, [])

  useEffect(() => { loadData(viewDate) }, [viewDate, loadData])

  // Streak + weight sparkline only for today
  useEffect(() => {
    fetch('/api/streak').then(r => r.json()).then(d => setStreak(d.streak ?? 0))
    fetch('/api/entries/weights?days=7').then(r => r.json()).then(d => setRecentWeights(d ?? []))
  }, [])

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const stepsCalories = activity?.steps_calories ?? 0
  const workoutCalories = activity?.workout_calories ?? 0

  const budget = profile
    ? getDailyBudget({
        tdee: (profile.tdee || Math.round(profile.bmr * 1.2)),
        deficitAmount: profile.deficit_amount,
        stepsCalories,
        workoutCalories,
      })
    : 0

  const remaining = budget - totals.calories
  const over = remaining < 0
  const isToday = viewDate === today
  const pct = budget > 0 ? totals.calories / budget : 0

  // Confetti when hitting 95–100% of budget
  useEffect(() => {
    if (!isToday || pct < 0.95 || pct > 1.0 || celebratedRef.current || budget === 0) return
    celebratedRef.current = true
    haptic('goal')
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#22c55e', '#86efac', '#ffffff'] })
    })
  }, [pct, isToday, budget])

  // Reset celebration flag when date or entries change
  useEffect(() => { celebratedRef.current = false }, [viewDate, entries.length])

  async function handleDelete(id: string) {
    haptic('light')
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    loadData(viewDate)
  }

  async function handleDeleteSteps() {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate, steps_count: 0, steps_calories: 0 }),
    })
    loadData(viewDate)
  }

  async function handleDeleteWorkout() {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate, workout_calories: 0 }),
    })
    loadData(viewDate)
  }

  async function handleManualAdd() {
    if (!manualForm.name || !manualForm.calories) return
    setManualSaving(true)
    haptic('medium')
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: viewDate,
        name: manualForm.name,
        calories: Number(manualForm.calories),
        protein: Number(manualForm.protein) || 0,
        carbs: Number(manualForm.carbs) || 0,
        fat: Number(manualForm.fat) || 0,
        fiber: 0, sugar: 0, sodium: 0,
        serving_size: Number(manualForm.serving_size) || 1,
        serving_unit: manualForm.serving_unit || 'serving',
        source: 'manual',
      }),
    })
    setManualForm({ name: '', calories: '', protein: '', carbs: '', fat: '', serving_size: '1', serving_unit: 'serving' })
    setShowManualAdd(false)
    setManualSaving(false)
    loadData(viewDate)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const statusLine = !profile ? '' : over
    ? `${Math.abs(Math.round(remaining))} kcal over`
    : `${Math.round(remaining)} kcal left`

  const emptyStateMsg = hour < 11
    ? 'Start your day — tell the AI what you had for breakfast'
    : hour < 16
    ? "What did you have for lunch? Log it in the Chat tab"
    : "Log dinner in the Chat tab to see how your day finished"

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-black">
      {/* Date nav + budget header */}
      <div className="shrink-0 px-4 pt-4 pb-3 bg-zinc-950 border-b border-zinc-800/60">
        {isToday && (
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-base">{greeting}</span>
                {streak >= 2 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">
                    🔥 {streak}-day streak
                  </span>
                )}
              </div>
              {recentWeights.length >= 2 && (
                <WeightSparkline weights={recentWeights} />
              )}
            </div>
            {statusLine && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${over ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                {statusLine}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setViewDate(offsetDate(viewDate, -1))}
            className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white bg-zinc-800 rounded-xl text-lg transition-colors">
            ‹
          </button>
          <div className="text-center">
            <div className="text-white font-semibold text-sm">{formatDisplayDate(viewDate)}</div>
            {!isToday && <div className="text-zinc-500 text-xs mt-0.5">past day</div>}
          </div>
          <button onClick={() => setViewDate(offsetDate(viewDate, 1))} disabled={isToday}
            className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white bg-zinc-800 rounded-xl text-lg transition-colors disabled:opacity-30">
            ›
          </button>
        </div>

        {/* Budget summary row */}
        {profile && (
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Budget</div>
              <div className="text-white font-bold text-lg leading-tight">{Math.round(budget)}</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Eaten</div>
              <div className="text-white font-bold text-lg leading-tight">{Math.round(totals.calories)}</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{over ? 'Over' : 'Left'}</div>
              <div className={`font-bold text-lg leading-tight ${over ? 'text-red-400' : 'text-green-400'}`}>
                {Math.abs(Math.round(remaining))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 pb-6">
        <CalorieRing
          eaten={totals.calories}
          budget={budget}
          tdee={profile ? (profile.tdee || Math.round(profile.bmr * 1.2)) : 0}
          deficitAmount={profile?.deficit_amount ?? 0}
          stepsCalories={stepsCalories}
          workoutCalories={workoutCalories}
          size={230}
        />

        {profile && (
          <MacroBar
            protein={totals.protein} proteinTarget={profile.protein_target_g}
            carbs={totals.carbs} carbsTarget={profile.carbs_target_g}
            fat={totals.fat} fatTarget={profile.fat_target_g}
          />
        )}

        <ActivityStrip
          stepsCount={activity?.steps_count ?? 0}
          stepsCalories={stepsCalories}
          workoutCalories={workoutCalories}
          onDeleteSteps={handleDeleteSteps}
          onDeleteWorkout={handleDeleteWorkout}
        />

        <WaterTracker
          waterMl={waterMl}
          date={viewDate}
          onChange={setWaterMl}
        />

        {/* Food log */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Food log</h3>
            <div className="flex items-center gap-2">
              {entries.length > 0 && (
                <span className="text-zinc-600 text-xs">{entries.length} items · {Math.round(totals.calories)} kcal</span>
              )}
              <button onClick={() => setShowManualAdd(v => !v)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${showManualAdd ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                + Manual
              </button>
            </div>
          </div>

          {/* Manual add form */}
          {showManualAdd && (
            <div className="bg-zinc-900 rounded-2xl p-4 mb-2 space-y-3">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Add food manually</div>
              <input
                value={manualForm.name}
                onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Food name *"
                className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm placeholder-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Calories *</div>
                  <input type="number" value={manualForm.calories}
                    onChange={e => setManualForm(f => ({ ...f, calories: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-500"
                  />
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Protein (g)</div>
                  <input type="number" value={manualForm.protein}
                    onChange={e => setManualForm(f => ({ ...f, protein: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-500"
                  />
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Carbs (g)</div>
                  <input type="number" value={manualForm.carbs}
                    onChange={e => setManualForm(f => ({ ...f, carbs: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-500"
                  />
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Fat (g)</div>
                  <input type="number" value={manualForm.fat}
                    onChange={e => setManualForm(f => ({ ...f, fat: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Serving size</div>
                  <input type="number" value={manualForm.serving_size}
                    onChange={e => setManualForm(f => ({ ...f, serving_size: e.target.value }))}
                    placeholder="1"
                    className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-500"
                  />
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Unit</div>
                  <input value={manualForm.serving_unit}
                    onChange={e => setManualForm(f => ({ ...f, serving_unit: e.target.value }))}
                    placeholder="serving"
                    className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowManualAdd(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-medium">
                  Cancel
                </button>
                <button onClick={handleManualAdd} disabled={!manualForm.name || !manualForm.calories || manualSaving}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-black text-sm font-bold disabled:opacity-40">
                  {manualSaving ? 'Adding…' : 'Add to log'}
                </button>
              </div>
            </div>
          )}

          {entries.length === 0 && !showManualAdd ? (
            <div className="bg-zinc-900 rounded-2xl p-6 text-center">
              <div className="text-2xl mb-2">🍽️</div>
              <div className="text-zinc-300 text-sm font-medium">{emptyStateMsg}</div>
              <div className="text-zinc-600 text-xs mt-1.5">or use the + Manual button above</div>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(e => <FoodCard key={e.id} entry={e} onDelete={handleDelete} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
