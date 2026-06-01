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

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [requestCount, setRequestCount] = useState(0)
  const [chatCleared, setChatCleared] = useState(false)

  function handleClearChat() {
    localStorage.removeItem('chat_history')
    setChatCleared(true)
    setTimeout(() => setChatCleared(false), 2000)
  }

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile)
    setRequestCount(getTodayCount())
  }, [])

  if (!profile) return (
    <div className="p-6 flex items-center justify-center min-h-40">
      <div className="text-gray-500 text-sm">Loading…</div>
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

  const rows: [string, string][] = [
    ['Age', `${ageYears} years`],
    ['Height', heightDisplay],
    ['Weight', weightDisplay],
    ['Goal', profile.goal],
    ['Activity level', profile.activity_level ? (ACTIVITY_LABELS[profile.activity_level] ?? profile.activity_level) : 'Sedentary'],
    ['BMR', `${Math.round(profile.bmr)} kcal`],
    ['TDEE', `${Math.round(tdee)} kcal`],
    ['Daily deficit', `${Math.round(profile.deficit_amount)} kcal`],
    ['Base daily target', `${Math.round(profile.target_calories)} kcal`],
    ['Protein target', `${Math.round(profile.protein_target_g)}g`],
    ['Carbs target', `${Math.round(profile.carbs_target_g)}g`],
    ['Fat target', `${Math.round(profile.fat_target_g)}g`],
  ]

  return (
    <div className="p-4 pb-8 space-y-4">
      <h1 className="text-white text-xl font-bold">Settings</h1>

      {/* Profile card */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
        <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">Profile</h2>
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">{label}</span>
            <span className="text-white text-sm font-medium capitalize">{value}</span>
          </div>
        ))}
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-gray-500 text-xs">To update targets, ask in Chat — e.g. "change my daily target to 1,600 kcal" or "update my weight to 81kg".</p>
        </div>
      </div>

      {/* Data */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
        <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">Data</h2>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white text-sm">Clear chat history</p>
            <p className="text-gray-500 text-xs mt-0.5">Removes messages from this device only</p>
          </div>
          <button onClick={handleClearChat}
            className={`text-sm font-medium px-4 py-1.5 rounded-xl transition-colors ${chatCleared ? 'bg-zinc-700 text-green-400' : 'bg-zinc-800 text-red-400 hover:bg-zinc-700'}`}>
            {chatCleared ? 'Cleared' : 'Clear'}
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-2.5">
        <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">App</h2>
        {[
          ['AI model', 'Gemini 3.5 Flash'],
          ['Storage', 'Supabase (cloud)'],
          ['Version', '1.0'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-400 text-sm">{label}</span>
            <span className="text-white text-sm">{value}</span>
          </div>
        ))}
        <div className="pt-2 border-t border-zinc-800 space-y-2.5">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-gray-400 text-sm">Requests today</span>
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
            <span className="text-gray-500 text-xs">Rate limit</span>
            <span className="text-zinc-400 text-xs">{MINUTE_LIMIT} requests / min</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Daily cap</span>
            <span className="text-zinc-400 text-xs">{DAILY_LIMIT} requests / day · resets midnight</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Images</span>
            <span className="text-zinc-400 text-xs">Multiple OK · counts as 1 request</span>
          </div>
          <p className="text-zinc-600 text-xs">Exact usage → ai.google.dev/rate-limit</p>
        </div>
      </div>

    </div>
  )
}
