'use client'
import { useEffect, useState, useCallback } from 'react'
import CalorieRing from '@/components/CalorieRing'
import MacroBar from '@/components/MacroBar'
import FoodCard from '@/components/FoodCard'
import ActivityStrip from '@/components/ActivityStrip'
import { getDailyBudget } from '@/lib/utils/calories'
import { formatDisplayDate, todayString, offsetDate } from '@/lib/utils/format'
import type { FoodEntry, UserProfile, DailyActivity } from '@/lib/db/types'

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [activity, setActivity] = useState<DailyActivity | null>(null)
  const [viewDate, setViewDate] = useState(todayString())
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
  }, [])

  useEffect(() => { loadData(viewDate) }, [viewDate, loadData])

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

  async function handleDelete(id: string) {
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

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-black">
      {/* Date nav + budget header */}
      <div className="shrink-0 px-4 pt-4 pb-3 bg-zinc-950 border-b border-zinc-800/60">
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
        {/* Calorie ring + budget breakdown */}
        <CalorieRing
          eaten={totals.calories}
          budget={budget}
          tdee={profile ? (profile.tdee || Math.round(profile.bmr * 1.2)) : 0}
          deficitAmount={profile?.deficit_amount ?? 0}
          stepsCalories={stepsCalories}
          workoutCalories={workoutCalories}
          size={230}
        />

        {/* Macros */}
        {profile && (
          <MacroBar
            protein={totals.protein} proteinTarget={profile.protein_target_g}
            carbs={totals.carbs} carbsTarget={profile.carbs_target_g}
            fat={totals.fat} fatTarget={profile.fat_target_g}
          />
        )}

        {/* Activity */}
        <ActivityStrip
          stepsCount={activity?.steps_count ?? 0}
          stepsCalories={stepsCalories}
          workoutCalories={workoutCalories}
          onDeleteSteps={handleDeleteSteps}
          onDeleteWorkout={handleDeleteWorkout}
        />

        {/* Food log */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Food log</h3>
            {entries.length > 0 && (
              <span className="text-zinc-600 text-xs">{entries.length} items · {Math.round(totals.calories)} kcal</span>
            )}
          </div>
          {entries.length === 0 ? (
            <div className="bg-zinc-900 rounded-2xl p-6 text-center">
              <div className="text-zinc-600 text-sm">Nothing logged yet</div>
              <div className="text-zinc-700 text-xs mt-1">Log food in the Chat tab →</div>
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
