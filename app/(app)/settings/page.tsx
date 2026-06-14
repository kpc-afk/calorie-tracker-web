'use client'
import { useEffect, useState } from 'react'
import type { UserProfile } from '@/lib/db/types'
import { kgToLbs, cmToFtIn, todayString } from '@/lib/utils/format'
import { getEffectiveTdee } from '@/lib/utils/calories'
import { haptic } from '@/lib/utils/haptic'
import { appCache } from '@/lib/utils/cache'
import MicroLabel from '@/components/ui/MicroLabel'
import HairlineCard from '@/components/ui/HairlineCard'

const DAILY_LIMIT = 500
const MINUTE_LIMIT = 10

function getTodayCount(): number {
  if (typeof window === 'undefined') return 0
  const key = `ai_requests_${todayString()}`
  return parseInt(localStorage.getItem(key) ?? '0', 10)
}

export function incrementRequestCount() {
  if (typeof window === 'undefined') return
  const key = `ai_requests_${todayString()}`
  localStorage.setItem(key, String(getTodayCount() + 1))
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-[var(--hairline)] first:border-t-0 first:pt-0">
      <span className="text-[13px] text-[var(--ink-60)]">{label}</span>
      <span className="text-[13px] text-[var(--ink)] tnum">{value}</span>
    </div>
  )
}

function Stepper({ value, display, min, max, step, description, onChange }: {
  value: number; display: string; min: number; max: number; step: number
  description: string; onChange: (next: number) => void
}) {
  function adjust(delta: number) {
    const next = Math.min(max, Math.max(min, value + delta))
    if (next === value) return
    haptic('light')
    onChange(next)
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="tnum text-[18px] text-[var(--ink)]">{display}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => adjust(-step)} disabled={value <= min}
            className="w-7 h-7 flex items-center justify-center border border-[var(--hairline)] rounded-[var(--radius)] text-[var(--ink-60)] hover:text-[var(--ink)] hover:border-[var(--hairline-strong)] disabled:opacity-30 transition-colors">
            −
          </button>
          <button onClick={() => adjust(step)} disabled={value >= max}
            className="w-7 h-7 flex items-center justify-center border border-[var(--hairline)] rounded-[var(--radius)] text-[var(--ink-60)] hover:text-[var(--ink)] hover:border-[var(--hairline-strong)] disabled:opacity-30 transition-colors">
            +
          </button>
        </div>
      </div>
      <p className="text-[12px] text-[var(--muted)] leading-relaxed">{description}</p>
    </div>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [requestCount, setRequestCount] = useState(0)
  const [chatCleared, setChatCleared] = useState(false)

  // Macro targets editor
  const [editingTargets, setEditingTargets] = useState(false)
  const [proteinTarget, setProteinTarget] = useState('')
  const [carbsTarget, setCarbsTarget] = useState('')
  const [fatTarget, setFatTarget] = useState('')
  const [savingTargets, setSavingTargets] = useState(false)
  const [targetsSaved, setTargetsSaved] = useState(false)

  function handleClearChat() {
    haptic('light')
    localStorage.removeItem('chat_history')
    setChatCleared(true)
    setTimeout(() => setChatCleared(false), 2000)
  }

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then((p: UserProfile) => {
      setProfile(p)
      setProteinTarget(String(Math.round(p?.protein_target_g ?? 0)))
      setCarbsTarget(String(Math.round(p?.carbs_target_g ?? 0)))
      setFatTarget(String(Math.round(p?.fat_target_g ?? 0)))
    })
    setRequestCount(getTodayCount())
  }, [])

  async function handleSaveTargets() {
    if (!profile) return
    haptic('light')
    setSavingTargets(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protein_target_g: Number(proteinTarget) || profile.protein_target_g,
        carbs_target_g: Number(carbsTarget) || profile.carbs_target_g,
        fat_target_g: Number(fatTarget) || profile.fat_target_g,
      }),
    })
    setProfile(p => p ? {
      ...p,
      protein_target_g: Number(proteinTarget) || p.protein_target_g,
      carbs_target_g: Number(carbsTarget) || p.carbs_target_g,
      fat_target_g: Number(fatTarget) || p.fat_target_g,
    } : p)
    appCache.invalidatePrefix('/api/profile')
    setSavingTargets(false)
    setTargetsSaved(true)
    setEditingTargets(false)
    setTimeout(() => setTargetsSaved(false), 2000)
  }

  async function updateBudgetField(field: 'baseline_steps' | 'earn_back_rate', value: number) {
    setProfile(p => p ? { ...p, [field]: value } : p)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    appCache.invalidatePrefix('/api/profile')
    appCache.invalidatePrefix('/api/analytics')
    appCache.invalidatePrefix('/api/adaptive-target')
  }

  if (!profile) return (
    <div className="px-5 pt-6 pb-8 space-y-5">
      <div className="font-display italic text-[26px] leading-none">Settings</div>
      {[1, 2, 3, 4].map(i => (
        <HairlineCard key={i} className="p-4 space-y-3">
          <div className="h-2.5 w-20 bg-[var(--hairline)] rounded animate-pulse" />
          {[1, 2, 3].map(j => (
            <div key={j} className="flex justify-between">
              <div className="h-3 w-24 bg-[var(--hairline)] rounded animate-pulse" />
              <div className="h-3 w-12 bg-[var(--hairline)] rounded animate-pulse" />
            </div>
          ))}
        </HairlineCard>
      ))}
    </div>
  )

  const ageYears = Math.floor(
    (Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)
  )
  const heightDisplay = profile.height_unit === 'ft'
    ? cmToFtIn(profile.height_cm)
    : `${profile.height_cm} cm`
  const weightDisplay = profile.weight_unit === 'lbs'
    ? `${kgToLbs(profile.weight_kg)} lbs`
    : `${profile.weight_kg} kg`
  const tdee = getEffectiveTdee(profile)
  const email = (profile as UserProfile & { email?: string }).email ?? ''

  const requestPct = Math.min((requestCount / DAILY_LIMIT) * 100, 100)

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="font-display italic text-[26px] leading-none">Settings</div>
      </div>

      <div className="px-5 space-y-5">
        {/* Profile */}
        <HairlineCard className="p-4 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <MicroLabel>Profile</MicroLabel>
            <span className="micro-label">{profile.goal} weight</span>
          </div>
          <div className="text-[15px] text-[var(--ink)] truncate mb-2">{email}</div>
          <Row label="Age" value={`${ageYears}y`} />
          <Row label="Height" value={heightDisplay} />
          <Row label="Weight" value={weightDisplay} />
          <Row label="BMR" value={`${Math.round(profile.bmr)} kcal`} />
          <Row label="TDEE" value={`${Math.round(tdee)} kcal`} />
          <Row label="Daily deficit" value={`${Math.round(profile.deficit_amount)} kcal`} />
          <Row label="Base target" value={`${Math.round(profile.target_calories)} kcal`} />
          <p className="text-[12px] text-[var(--muted)] pt-2 border-t border-[var(--hairline)] mt-2">
            Update weight or deficit via Chat — &ldquo;update my weight to 80kg&rdquo;
          </p>
        </HairlineCard>

        {/* Targets */}
        <HairlineCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <MicroLabel>Macro targets</MicroLabel>
            {!editingTargets && (
              <button onClick={() => setEditingTargets(true)}
                className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                Edit
              </button>
            )}
          </div>

          {editingTargets ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Protein', value: proteinTarget, set: setProteinTarget },
                  { label: 'Carbs', value: carbsTarget, set: setCarbsTarget },
                  { label: 'Fat', value: fatTarget, set: setFatTarget },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <input type="number" inputMode="decimal" value={value} onChange={e => set(e.target.value)}
                      className="w-full bg-transparent border-b border-[var(--hairline)] pb-2 text-[15px] tnum text-[var(--ink)] text-center focus:outline-none focus:border-[var(--hairline-strong)]"
                    />
                    <div className="text-center text-[10px] text-[var(--muted)] mt-1 uppercase tracking-[0.08em]">{label} (g)</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingTargets(false)}
                  className="flex-1 py-2.5 border border-[var(--hairline)] rounded-[var(--radius)] text-[var(--ink-60)] text-[13px] font-medium">
                  Cancel
                </button>
                <button onClick={handleSaveTargets} disabled={savingTargets}
                  className="flex-1 py-2.5 bg-[var(--accent)] text-[var(--accent-ink)] rounded-[var(--radius)] text-[13px] font-semibold disabled:opacity-40">
                  {savingTargets ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {targetsSaved && <p className="text-[12px] text-[var(--accent)]">Saved</p>}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="font-display tnum text-[26px] leading-none text-[var(--ink)]">{Math.round(profile.protein_target_g)}</div>
                  <div className="micro-label mt-1.5">Protein g</div>
                </div>
                <div>
                  <div className="font-display tnum text-[26px] leading-none text-[var(--ink)]">{Math.round(profile.carbs_target_g)}</div>
                  <div className="micro-label mt-1.5">Carbs g</div>
                </div>
                <div>
                  <div className="font-display tnum text-[26px] leading-none text-[var(--ink)]">{Math.round(profile.fat_target_g)}</div>
                  <div className="micro-label mt-1.5">Fat g</div>
                </div>
              </div>
            </>
          )}
        </HairlineCard>

        {/* Budget model */}
        <HairlineCard className="p-4 space-y-4">
          <MicroLabel>Budget model</MicroLabel>
          <Stepper
            value={profile.baseline_steps}
            display={`${profile.baseline_steps.toLocaleString()} steps`}
            min={0} max={10000} step={500}
            description="Steps below this are already in your TDEE — only steps above it add to your budget."
            onChange={v => updateBudgetField('baseline_steps', v)}
          />
          <div className="hairline-t" />
          <Stepper
            value={Math.round(profile.earn_back_rate * 100)}
            display={`${Math.round(profile.earn_back_rate * 100)}%`}
            min={50} max={100} step={5}
            description="Fraction of activity calories (steps + workouts) added back to your budget."
            onChange={v => updateBudgetField('earn_back_rate', v / 100)}
          />
        </HairlineCard>

        {/* Data */}
        <HairlineCard className="p-4 space-y-3">
          <MicroLabel>Data</MicroLabel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-[var(--ink)]">Clear chat history</p>
              <p className="text-[12px] text-[var(--muted)] mt-0.5">Removes messages from this device only</p>
            </div>
            <button onClick={handleClearChat}
              className={`text-[10px] font-semibold uppercase tracking-[0.08em] px-3 py-1.5 border rounded-[var(--radius)] transition-colors ${
                chatCleared ? 'border-[var(--hairline)] text-[var(--accent)]' : 'border-[var(--hairline)] text-[var(--danger)] hover:border-[var(--hairline-strong)]'
              }`}>
              {chatCleared ? 'Cleared' : 'Clear'}
            </button>
          </div>
        </HairlineCard>

        {/* App */}
        <HairlineCard className="p-4 space-y-3">
          <MicroLabel>App</MicroLabel>
          <Row label="AI model" value="Gemini Flash" />
          <Row label="Storage" value="Supabase" />
          <Row label="Version" value="2.0" />
          <div className="pt-2 border-t border-[var(--hairline)] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[var(--ink-60)]">Requests today</span>
              <span className="text-[13px] text-[var(--ink)] tnum">{requestCount} / {DAILY_LIMIT}</span>
            </div>
            <div className="h-1 bg-[var(--hairline)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${requestPct}%`, backgroundColor: requestPct > 85 ? 'var(--danger)' : 'var(--accent)' }} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[var(--muted)]">Rate limit</span>
              <span className="text-[12px] text-[var(--ink-60)] tnum">{MINUTE_LIMIT} / min</span>
            </div>
          </div>
        </HairlineCard>
      </div>
    </div>
  )
}
