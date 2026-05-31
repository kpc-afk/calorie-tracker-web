'use client'
import { useEffect, useState } from 'react'
import type { UserProfile } from '@/lib/db/types'
import { kgToLbs, cmToFtIn } from '@/lib/utils/format'
import { ACTIVITY_LABELS } from '@/lib/utils/calories'

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile)
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

      {/* App info */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-2.5">
        <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">App</h2>
        {[
          ['AI model', 'Gemini 2.5 Pro'],
          ['Storage', 'Supabase (cloud)'],
          ['Version', '1.0'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-400 text-sm">{label}</span>
            <span className="text-white text-sm">{value}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
