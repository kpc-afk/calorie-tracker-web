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

  const budget = profile
    ? getDailyBudget({
        bmr: profile.bmr,
        deficitAmount: profile.deficit_amount,
        stepsCalories: activity?.steps_calories ?? 0,
        workoutCalories: activity?.workout_calories ?? 0,
      })
    : 0

  async function handleDelete(id: string) {
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    loadData(viewDate)
  }

  const isToday = viewDate === today

  return (
    <div className="p-4 pb-6 space-y-4">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setViewDate(offsetDate(viewDate, -1))}
          className="text-gray-400 text-2xl w-10 h-10 flex items-center justify-center">‹</button>
        <h2 className="text-white font-semibold">{formatDisplayDate(viewDate)}</h2>
        <button onClick={() => setViewDate(offsetDate(viewDate, 1))} disabled={isToday}
          className="text-gray-400 text-2xl w-10 h-10 flex items-center justify-center disabled:opacity-30">›</button>
      </div>

      {/* Calorie ring */}
      <div className="flex justify-center py-2">
        <CalorieRing eaten={totals.calories} budget={budget} />
      </div>

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
        stepsCalories={activity?.steps_calories ?? 0}
        workoutCalories={activity?.workout_calories ?? 0}
      />

      {/* Food log */}
      <div>
        <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2 px-1">Food log</h3>
        {entries.length === 0
          ? (
            <div className="text-center text-gray-600 py-10 text-sm">
              No entries yet — log food in the Chat tab 💬
            </div>
          )
          : (
            <div className="space-y-2">
              {entries.map(e => <FoodCard key={e.id} entry={e} onDelete={handleDelete} />)}
            </div>
          )
        }
      </div>

      {/* Daily totals footer */}
      {entries.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-3 flex justify-between text-xs text-gray-400">
          <span>{entries.length} items</span>
          <span className="text-white font-medium">{Math.round(totals.calories)} kcal total</span>
        </div>
      )}
    </div>
  )
}
