'use client'
import { useEffect, useState, useRef } from 'react'
import CalorieRing from '@/components/CalorieRing'
import MacroBar from '@/components/MacroBar'
import FoodCard from '@/components/FoodCard'
import ActivityStrip from '@/components/ActivityStrip'
import WeightSparkline from '@/components/WeightSparkline'
import WaterTracker from '@/components/WaterTracker'
import BudgetSheet from '@/components/BudgetSheet'
import BankingStrip from '@/components/BankingStrip'
import MicroLabel from '@/components/ui/MicroLabel'
import StatNumeral from '@/components/ui/StatNumeral'
import HairlineCard from '@/components/ui/HairlineCard'
import { getBudgetBreakdown } from '@/lib/utils/calories'
import { computeWeekBank, type DayLedger } from '@/lib/utils/banking'
import { todayLondon, addDays } from '@/lib/utils/dates'
import { haptic } from '@/lib/utils/haptic'
import { useCachedFetch } from '@/lib/utils/useCachedFetch'
import { appCache } from '@/lib/utils/cache'
import type { FoodEntry, UserProfile, DailyActivity, WeightEntry } from '@/lib/db/types'

function formatMasthead(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
  const day = d.getUTCDate()
  const month = d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
  return `${weekday} — ${day} ${month}`
}

type Meal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks'
const MEAL_ORDER: Meal[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

function mealGroup(createdAt: string): Meal {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }).format(new Date(createdAt))
  )
  if (hour < 11) return 'Breakfast'
  if (hour < 16) return 'Lunch'
  if (hour < 22) return 'Dinner'
  return 'Snacks'
}

export default function DashboardPage() {
  const [viewDate, setViewDate] = useState(todayLondon())
  const [waterMl, setWaterMl] = useState(0)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [showBudgetSheet, setShowBudgetSheet] = useState(false)
  const [copyingYesterday, setCopyingYesterday] = useState(false)
  const [manualForm, setManualForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' })
  const [manualSaving, setManualSaving] = useState(false)
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())
  const celebratedRef = useRef(false)
  const today = todayLondon()
  const isToday = viewDate === today

  const { data: profile } = useCachedFetch<UserProfile>('/api/profile')
  const { data: entriesData, refresh: refreshEntries } = useCachedFetch<FoodEntry[]>(`/api/entries?date=${viewDate}`)
  const { data: activityData, refresh: refreshActivity } = useCachedFetch<DailyActivity>(`/api/activity?date=${viewDate}`)
  const { data: streakData } = useCachedFetch<{ streak: number }>('/api/streak')
  const { data: weightsData } = useCachedFetch<WeightEntry[]>('/api/entries/weights?days=7')
  const { data: weekData, refresh: refreshWeek } = useCachedFetch<{ days: DayLedger[]; todayBudget: number }>('/api/week')

  const entries = (entriesData ?? []).filter(e => !pendingDeletes.has(e.id))
  const activity = activityData ?? null
  const streak = streakData?.streak ?? 0
  const recentWeights = weightsData ?? []

  useEffect(() => { setWaterMl(activity?.water_ml ?? 0) }, [activity])

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const breakdown = profile
    ? getBudgetBreakdown(profile, activity?.steps_count ?? 0, activity?.workout_calories ?? 0)
    : null

  const budget = breakdown?.total ?? 0
  const pct = budget > 0 ? totals.calories / budget : 0
  const weekBank = weekData ? computeWeekBank(weekData.days, today, weekData.todayBudget) : null

  const carbHeadroom = profile && breakdown
    ? Math.round((breakdown.total - profile.protein_target_g * 4 - profile.fat_target_g * 9) / 4)
    : undefined

  const proteinRemaining = profile ? Math.max(Math.round(profile.protein_target_g - totals.protein), 0) : 0
  const proteinHit = !!profile && totals.protein >= profile.protein_target_g

  // Confetti when hitting 95–100% of budget
  useEffect(() => {
    if (!isToday || pct < 0.95 || pct > 1.0 || celebratedRef.current || budget === 0) return
    celebratedRef.current = true
    haptic('goal')
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#C8FF1C', '#F2EFE6'] })
    })
  }, [pct, isToday, budget])

  // Reset celebration flag when date or entries change
  useEffect(() => { celebratedRef.current = false }, [viewDate, entries.length])

  async function handleDelete(id: string) {
    haptic('light')
    setPendingDeletes(prev => new Set(prev).add(id))
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    appCache.invalidatePrefix('/api/entries')
    await refreshEntries()
    setPendingDeletes(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  async function handleDeleteSteps() {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate, steps_count: 0, steps_calories: 0 }),
    })
    appCache.invalidatePrefix('/api/activity')
    appCache.invalidatePrefix('/api/week')
    await refreshActivity()
    await refreshWeek()
  }

  async function handleDeleteWorkout() {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate, workout_calories: 0 }),
    })
    appCache.invalidatePrefix('/api/activity')
    appCache.invalidatePrefix('/api/week')
    await refreshActivity()
    await refreshWeek()
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
        serving_size: '1',
        serving_unit: 'serving',
        source: 'manual',
      }),
    })
    setManualForm({ name: '', calories: '', protein: '', carbs: '', fat: '' })
    setShowManualAdd(false)
    setManualSaving(false)
    appCache.invalidatePrefix('/api/entries')
    await refreshEntries()
  }

  async function handleCopyYesterday() {
    setCopyingYesterday(true)
    haptic('medium')
    await fetch('/api/entries/copy-yesterday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: viewDate }),
    })
    setCopyingYesterday(false)
    appCache.invalidatePrefix('/api/entries')
    await refreshEntries()
  }

  const hour = new Date().getHours()
  const emptyStateMsg = hour < 11
    ? 'Start your day — tell the AI what you had for breakfast'
    : hour < 16
    ? 'What did you have for lunch? Log it in the Chat tab'
    : 'Log dinner in the Chat tab to see how your day finished'

  const groupedEntries = MEAL_ORDER
    .map(meal => ({ meal, items: entries.filter(e => mealGroup(e.created_at) === meal) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setViewDate(addDays(viewDate, -1))}
            className="w-8 h-8 flex items-center justify-center border border-[var(--hairline)] rounded-[var(--radius)] text-[var(--ink-60)] text-lg shrink-0">
            ‹
          </button>
          <div className="text-center flex-1 min-w-0">
            <div className="font-display italic text-[22px] leading-none truncate">{formatMasthead(viewDate)}</div>
            {isToday && recentWeights.length >= 2 && (
              <div className="flex justify-center mt-1.5">
                <WeightSparkline weights={recentWeights} />
              </div>
            )}
          </div>
          <button onClick={() => setViewDate(addDays(viewDate, 1))} disabled={isToday}
            className="w-8 h-8 flex items-center justify-center border border-[var(--hairline)] rounded-[var(--radius)] text-[var(--ink-60)] text-lg shrink-0 disabled:opacity-30">
            ›
          </button>
        </div>
        {isToday && streak >= 2 && (
          <div className="text-center mt-3">
            <MicroLabel>Day {streak}</MicroLabel>
          </div>
        )}
      </div>

      {/* Skeleton */}
      {!profile && (
        <div className="px-5 py-4 space-y-3">
          <div className="w-56 h-56 rounded-full bg-[var(--hairline)] animate-pulse mx-auto" />
          <div className="border border-[var(--hairline)] rounded-[var(--radius)] p-4 animate-pulse h-20" />
          <div className="border border-[var(--hairline)] rounded-[var(--radius)] p-4 animate-pulse h-16" />
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-[var(--hairline)] rounded-[var(--radius)] p-4 animate-pulse h-16" />
          ))}
        </div>
      )}

      {profile && breakdown && (
        <div className="px-5 py-2 space-y-4">
          {/* Hero */}
          <button onClick={() => setShowBudgetSheet(true)} className="w-full">
            <CalorieRing eaten={totals.calories} breakdown={breakdown} size={224} />
          </button>
          <div className="text-center">
            <StatNumeral
              value={proteinHit ? '✓' : proteinRemaining}
              label={proteinHit ? 'protein floor hit' : 'protein to go'}
              size="hero"
              tone={proteinHit ? 'accent' : 'ink'}
              suffix={proteinHit ? undefined : 'g'}
            />
          </div>

          {/* Banking strip */}
          {weekData && weekBank && (
            <BankingStrip days={weekData.days} weekBank={weekBank} />
          )}

          {/* Macro bar */}
          <MacroBar
            protein={totals.protein} proteinTarget={profile.protein_target_g}
            carbs={totals.carbs} carbsTarget={profile.carbs_target_g}
            fat={totals.fat} fatTarget={profile.fat_target_g}
            carbHeadroom={carbHeadroom}
          />

          {/* Activity + Water */}
          <ActivityStrip
            stepsCount={activity?.steps_count ?? 0}
            stepsCalories={activity?.steps_calories ?? 0}
            workoutCalories={activity?.workout_calories ?? 0}
            onDeleteSteps={handleDeleteSteps}
            onDeleteWorkout={handleDeleteWorkout}
          />
          <WaterTracker
            waterMl={waterMl}
            date={viewDate}
            onChange={ml => { setWaterMl(ml); appCache.invalidatePrefix('/api/activity') }}
          />

          {/* Food log */}
          <div>
            <div className="flex items-center justify-between mb-3 px-0.5">
              <MicroLabel>Food log</MicroLabel>
              <div className="flex items-center gap-3">
                {entries.length > 0 && (
                  <span className="text-[11px] tnum text-[var(--ink-60)]">{entries.length} items · {Math.round(totals.calories)} kcal</span>
                )}
                {entries.length === 0 && isToday && (
                  <button onClick={handleCopyYesterday} disabled={copyingYesterday}
                    className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-60)] hover:text-[var(--ink)] transition-colors disabled:opacity-50">
                    {copyingYesterday ? 'Copying…' : 'Copy yesterday'}
                  </button>
                )}
                <button onClick={() => setShowManualAdd(v => !v)}
                  className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                  {showManualAdd ? 'Cancel' : '+ Manual'}
                </button>
              </div>
            </div>

            {showManualAdd && (
              <HairlineCard className="p-4 mb-3 space-y-3">
                <input
                  value={manualForm.name}
                  onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Food name"
                  autoFocus
                  className="w-full bg-transparent border-b border-[var(--hairline)] pb-2 text-[15px] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--hairline-strong)]"
                />
                <div className="grid grid-cols-4 gap-3">
                  <NumberField label="kcal" value={manualForm.calories} onChange={v => setManualForm(f => ({ ...f, calories: v }))} />
                  <NumberField label="P" value={manualForm.protein} onChange={v => setManualForm(f => ({ ...f, protein: v }))} />
                  <NumberField label="C" value={manualForm.carbs} onChange={v => setManualForm(f => ({ ...f, carbs: v }))} />
                  <NumberField label="F" value={manualForm.fat} onChange={v => setManualForm(f => ({ ...f, fat: v }))} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowManualAdd(false)}
                    className="flex-1 py-2.5 border border-[var(--hairline)] rounded-[var(--radius)] text-[var(--ink-60)] text-[13px] font-medium">
                    Cancel
                  </button>
                  <button onClick={handleManualAdd} disabled={!manualForm.name || !manualForm.calories || manualSaving}
                    className="flex-1 py-2.5 bg-[var(--accent)] text-[var(--accent-ink)] rounded-[var(--radius)] text-[13px] font-semibold disabled:opacity-40">
                    {manualSaving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </HairlineCard>
            )}

            {entries.length === 0 && !showManualAdd ? (
              <HairlineCard className="p-6 text-center">
                <div className="text-[13px] text-[var(--ink-60)]">{emptyStateMsg}</div>
              </HairlineCard>
            ) : (
              groupedEntries.map(g => (
                <div key={g.meal} className="mb-4">
                  <div className="flex items-center justify-between mb-1 px-0.5">
                    <MicroLabel>{g.meal}</MicroLabel>
                    <span className="text-[11px] tnum text-[var(--ink-60)]">{Math.round(g.items.reduce((s, e) => s + e.calories, 0))} kcal</span>
                  </div>
                  {g.items.map(e => <FoodCard key={e.id} entry={e} onDelete={handleDelete} />)}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {breakdown && (
        <BudgetSheet
          open={showBudgetSheet}
          onClose={() => setShowBudgetSheet(false)}
          breakdown={breakdown}
          eaten={totals.calories}
        />
      )}
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder="0"
        className="w-full bg-transparent border-b border-[var(--hairline)] pb-2 text-[15px] tnum text-[var(--ink)] placeholder-[var(--muted)] text-center focus:outline-none focus:border-[var(--hairline-strong)]" />
      <div className="text-center text-[10px] text-[var(--muted)] mt-1 uppercase tracking-[0.08em]">{label}</div>
    </div>
  )
}
