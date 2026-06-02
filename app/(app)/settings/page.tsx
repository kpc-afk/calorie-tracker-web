'use client'
import { useEffect, useState } from 'react'
import type { UserProfile } from '@/lib/db/types'
import { kgToLbs, cmToFtIn, todayString } from '@/lib/utils/format'
import { ACTIVITY_LABELS } from '@/lib/utils/calories'

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

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

function AppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
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
    setSavingTargets(false)
    setTargetsSaved(true)
    setEditingTargets(false)
    setTimeout(() => setTargetsSaved(false), 2000)
  }

  if (!profile) return (
    <div className="p-6 space-y-4">
      {/* Skeleton avatar */}
      <div className="bg-zinc-900 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-zinc-800 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2" />
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/3" />
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-zinc-900 rounded-2xl p-4 space-y-3">
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/4" />
          {[1, 2, 3].map(j => (
            <div key={j} className="flex justify-between">
              <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/3" />
              <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/4" />
            </div>
          ))}
        </div>
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
  const tdee = (profile.tdee || Math.round(profile.bmr * 1.2))
  const initial = (profile as UserProfile & { name?: string; email?: string }).email?.[0]?.toUpperCase() ?? '?'
  const email = (profile as UserProfile & { email?: string }).email ?? ''

  const goalBadgeColor = profile.goal === 'lose' ? 'bg-red-500/15 text-red-400'
    : profile.goal === 'gain' ? 'bg-blue-500/15 text-blue-400'
    : 'bg-green-500/15 text-green-400'

  return (
    <div className="p-4 pb-8 space-y-4">
      {/* Avatar card */}
      <div className="bg-zinc-900 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/30 flex items-center justify-center shrink-0">
          <span className="text-green-400 font-bold text-2xl">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-base truncate">{email}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${goalBadgeColor}`}>
              {profile.goal} weight
            </span>
            <span className="text-zinc-600 text-xs">{ageYears}y · {weightDisplay}</span>
          </div>
        </div>
      </div>

      {/* Profile stats */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-green-500"><ProfileIcon /></span>
          <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Profile</h2>
        </div>
        {([
          ['Height', heightDisplay],
          ['Activity', profile.activity_level ? (ACTIVITY_LABELS[profile.activity_level] ?? profile.activity_level) : 'Sedentary'],
          ['BMR', `${Math.round(profile.bmr)} kcal`],
          ['TDEE', `${Math.round(tdee)} kcal`],
          ['Daily deficit', `${Math.round(profile.deficit_amount)} kcal`],
          ['Base target', `${Math.round(profile.target_calories)} kcal`],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-zinc-500 text-sm">{label}</span>
            <span className="text-white text-sm font-medium capitalize">{value}</span>
          </div>
        ))}
        <div className="pt-2 border-t border-zinc-800/80">
          <p className="text-zinc-600 text-xs">Update weight/deficit via Chat — "update my weight to 80kg"</p>
        </div>
      </div>

      {/* Macro targets */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-green-500"><TargetIcon /></span>
            <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Targets</h2>
          </div>
          {!editingTargets && (
            <button onClick={() => setEditingTargets(true)}
              className="text-xs text-zinc-500 hover:text-white transition-colors">
              Edit
            </button>
          )}
        </div>

        {editingTargets ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Protein', value: proteinTarget, set: setProteinTarget, color: 'text-emerald-400' },
                { label: 'Carbs', value: carbsTarget, set: setCarbsTarget, color: 'text-blue-400' },
                { label: 'Fat', value: fatTarget, set: setFatTarget, color: 'text-orange-400' },
              ].map(({ label, value, set, color }) => (
                <div key={label}>
                  <div className={`text-xs font-semibold mb-1 ${color}`}>{label}</div>
                  <div className="relative">
                    <input type="number" value={value} onChange={e => set(e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-xl px-2 py-2 text-sm text-center focus:outline-none border border-zinc-700 focus:border-zinc-500 pr-5"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">g</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingTargets(false)}
                className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm">
                Cancel
              </button>
              <button onClick={handleSaveTargets} disabled={savingTargets}
                className="flex-1 py-2 rounded-xl bg-green-500 text-black text-sm font-bold disabled:opacity-40">
                {savingTargets ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {targetsSaved && (
              <div className="text-green-400 text-xs font-medium">Saved</div>
            )}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-emerald-400 font-bold text-lg">{Math.round(profile.protein_target_g)}g</div>
                <div className="text-zinc-600 text-xs mt-0.5">Protein</div>
              </div>
              <div>
                <div className="text-blue-400 font-bold text-lg">{Math.round(profile.carbs_target_g)}g</div>
                <div className="text-zinc-600 text-xs mt-0.5">Carbs</div>
              </div>
              <div>
                <div className="text-orange-400 font-bold text-lg">{Math.round(profile.fat_target_g)}g</div>
                <div className="text-zinc-600 text-xs mt-0.5">Fat</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Data */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-green-500"><DatabaseIcon /></span>
          <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Data</h2>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white text-sm">Clear chat history</p>
            <p className="text-zinc-600 text-xs mt-0.5">Removes messages from this device only</p>
          </div>
          <button onClick={handleClearChat}
            className={`text-sm font-medium px-4 py-1.5 rounded-xl transition-colors ${chatCleared ? 'bg-zinc-700 text-green-400' : 'bg-zinc-800 text-red-400 hover:bg-zinc-700'}`}>
            {chatCleared ? 'Cleared' : 'Clear'}
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-green-500"><AppIcon /></span>
          <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-wider">App</h2>
        </div>
        {([
          ['AI model', 'Gemini Flash'],
          ['Storage', 'Supabase (cloud)'],
          ['Version', '1.0'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-zinc-500 text-sm">{label}</span>
            <span className="text-white text-sm">{value}</span>
          </div>
        ))}
        <div className="pt-2 border-t border-zinc-800 space-y-2.5">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-zinc-500 text-sm">Requests today</span>
              <span className="text-white text-sm font-medium">{requestCount} / {DAILY_LIMIT}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((requestCount / DAILY_LIMIT) * 100, 100)}%`,
                  backgroundColor: requestCount > DAILY_LIMIT * 0.85 ? '#ef4444' : requestCount > DAILY_LIMIT * 0.6 ? '#f97316' : '#22c55e'
                }} />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-600 text-xs">Rate limit</span>
            <span className="text-zinc-400 text-xs">{MINUTE_LIMIT} requests / min</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-600 text-xs">Daily cap</span>
            <span className="text-zinc-400 text-xs">{DAILY_LIMIT} requests / day</span>
          </div>
        </div>
      </div>
    </div>
  )
}
