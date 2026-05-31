'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/db/types'
import { kgToLbs, cmToFtIn } from '@/lib/utils/format'

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

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

  const rows: [string, string][] = [
    ['Age', `${ageYears} years`],
    ['Height', heightDisplay],
    ['Weight', weightDisplay],
    ['Goal', profile.goal],
    ['BMR', `${Math.round(profile.bmr)} kcal`],
    ['Baseline target', `${Math.round(profile.target_calories)} kcal`],
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
          <button onClick={() => router.push('/onboarding')}
            className="w-full bg-zinc-800 text-white py-2.5 rounded-xl text-sm border border-zinc-700 hover:border-zinc-500 transition-colors">
            Edit profile &amp; recalculate targets
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="bg-zinc-900 rounded-2xl p-4 space-y-2.5">
        <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">App</h2>
        {[
          ['AI model', 'Gemini 1.5 Flash'],
          ['Storage', 'Supabase (cloud)'],
          ['Version', '1.0'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-400 text-sm">{label}</span>
            <span className="text-white text-sm">{value}</span>
          </div>
        ))}
      </div>

      {/* Sign out */}
      <button onClick={handleSignOut}
        className="w-full bg-zinc-900 text-red-400 py-3.5 rounded-2xl text-sm font-medium border border-zinc-800 hover:border-zinc-700 transition-colors">
        Sign out
      </button>
    </div>
  )
}
