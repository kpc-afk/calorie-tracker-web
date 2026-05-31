'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ACTIVITY_LABELS, ACTIVITY_DESCRIPTIONS } from '@/lib/utils/calories'
import type { ActivityLevel } from '@/lib/db/types'

type Step = 'form' | 'result'

type FormData = {
  dateOfBirth: string
  sex: 'male' | 'female' | ''
  heightCm: string
  weightKg: string
  heightUnit: 'cm' | 'ft'
  weightUnit: 'kg' | 'lbs'
  goal: 'lose' | 'maintain' | 'gain' | ''
  activityLevel: ActivityLevel
}

type TDEEResult = {
  bmr: number
  tdee: number
  activityLevel: string
  deficitAmount: number
  targetCalories: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  explanation: string
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const ACTIVITY_ORDER: ActivityLevel[] = [
  'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TDEEResult | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormData>({
    dateOfBirth: '', sex: '', heightCm: '', weightKg: '',
    heightUnit: 'cm', weightUnit: 'kg', goal: '',
    activityLevel: 'sedentary',
  })

  function setField(key: keyof FormData, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const isFormValid = form.dateOfBirth && form.sex && form.heightCm && form.weightKg && form.goal

  async function handleCalculate() {
    if (!isFormValid) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tdee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateOfBirth: form.dateOfBirth,
          sex: form.sex,
          heightCm: Number(form.heightCm),
          weightKg: Number(form.weightKg),
          goal: form.goal,
          activityLevel: form.activityLevel,
        }),
      })
      if (!res.ok) throw new Error('Calculation failed')
      const data: TDEEResult = await res.json()
      setResult(data)
      setChatHistory([{ role: 'assistant', content: data.explanation }])
      setStep('result')
    } catch {
      setError('Could not calculate targets. Please try again.')
    }
    setLoading(false)
  }

  async function handleChatSend() {
    if (!chatInput.trim() || !result) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatLoading(true)
    setChatHistory(h => [...h, { role: 'user', content: userMsg }])
    try {
      const res = await fetch('/api/tdee/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          currentBMR: result.bmr,
          currentTDEE: result.tdee,
          currentDeficit: result.deficitAmount,
          goal: form.goal,
          weightKg: Number(form.weightKg),
          history: chatHistory,
        }),
      })
      const { reply } = await res.json()
      setChatHistory(h => [...h, { role: 'assistant', content: reply ?? 'Sorry, could not get a response.' }])
    } catch {
      setChatHistory(h => [...h, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    }
    setChatLoading(false)
  }

  async function handleConfirm() {
    if (!result) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_of_birth: form.dateOfBirth,
          sex: form.sex,
          height_cm: Number(form.heightCm),
          weight_kg: Number(form.weightKg),
          height_unit: form.heightUnit,
          weight_unit: form.weightUnit,
          goal: form.goal,
          activity_level: form.activityLevel,
          bmr: result.bmr,
          tdee: result.tdee,
          deficit_amount: result.deficitAmount,
          target_calories: result.targetCalories,
          protein_target_g: result.proteinTargetG,
          carbs_target_g: result.carbsTargetG,
          fat_target_g: result.fatTargetG,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      router.push('/chat')
    } catch {
      setError('Could not save your profile. Please try again.')
    }
    setLoading(false)
  }

  if (step === 'form') return (
    <div className="min-h-screen bg-black p-6 pb-16 max-w-lg mx-auto">
      <h1 className="text-white text-2xl font-bold mb-1">Set up your profile</h1>
      <p className="text-gray-400 mb-8 text-sm">We&apos;ll calculate your TDEE and recommend a daily target.</p>

      <div className="space-y-5">
        <div>
          <label className="text-gray-400 text-sm mb-1.5 block">Date of birth</label>
          <input type="date" value={form.dateOfBirth} onChange={e => setField('dateOfBirth', e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-1.5 block">Sex</label>
          <div className="flex gap-3">
            {(['male', 'female'] as const).map(s => (
              <button key={s} onClick={() => setField('sex', s)}
                className={`flex-1 py-3 rounded-xl font-medium capitalize transition-colors ${form.sex === s ? 'bg-green-500 text-black' : 'bg-zinc-900 text-white border border-zinc-700'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-gray-400 text-sm">Height</label>
            <button onClick={() => setField('heightUnit', form.heightUnit === 'cm' ? 'ft' : 'cm')}
              className="text-green-500 text-xs">Switch to {form.heightUnit === 'cm' ? 'ft/in' : 'cm'}</button>
          </div>
          <input type="number" value={form.heightCm} onChange={e => setField('heightCm', e.target.value)}
            placeholder="Height in cm (e.g. 178)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-gray-400 text-sm">Weight</label>
            <button onClick={() => setField('weightUnit', form.weightUnit === 'kg' ? 'lbs' : 'kg')}
              className="text-green-500 text-xs">Switch to {form.weightUnit === 'kg' ? 'lbs' : 'kg'}</button>
          </div>
          <input type="number" value={form.weightKg} onChange={e => setField('weightKg', e.target.value)}
            placeholder="Weight in kg (e.g. 75)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-2 block">Goal</label>
          <div className="space-y-2">
            {[
              { val: 'lose' as const, label: 'Lose weight', desc: 'Calorie deficit below TDEE' },
              { val: 'maintain' as const, label: 'Maintain weight', desc: 'Eat at your TDEE' },
              { val: 'gain' as const, label: 'Gain muscle', desc: 'Calorie surplus above TDEE' },
            ].map(g => (
              <button key={g.val} onClick={() => setField('goal', g.val)}
                className={`w-full p-4 rounded-xl text-left border transition-colors ${form.goal === g.val ? 'border-green-500 bg-green-500/10' : 'border-zinc-700 bg-zinc-900'}`}>
                <div className="text-white font-medium text-sm">{g.label}</div>
                <div className="text-gray-400 text-xs mt-0.5">{g.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-sm mb-2 block">Activity level</label>
          <div className="space-y-2">
            {ACTIVITY_ORDER.map(level => (
              <button key={level} onClick={() => setField('activityLevel', level)}
                className={`w-full p-4 rounded-xl text-left border transition-colors ${form.activityLevel === level ? 'border-green-500 bg-green-500/10' : 'border-zinc-700 bg-zinc-900'}`}>
                <div className="text-white font-medium text-sm">{ACTIVITY_LABELS[level]}</div>
                <div className="text-gray-400 text-xs mt-0.5">{ACTIVITY_DESCRIPTIONS[level]}</div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button onClick={handleCalculate} disabled={!isFormValid || loading}
          className="w-full bg-green-500 text-black font-semibold py-4 rounded-xl mt-2 disabled:opacity-40 transition-opacity">
          {loading ? 'Calculating…' : 'Calculate my targets →'}
        </button>
      </div>
    </div>
  )

  if (step === 'result' && result) return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="p-6 pb-4">
        <h1 className="text-white text-2xl font-bold mb-1">Your targets</h1>
        <p className="text-gray-400 text-sm">Based on your TDEE. Workout calories are added daily.</p>
      </div>

      <div className="px-6 mb-4">
        <div className="bg-zinc-900 rounded-2xl p-5 space-y-3">
          {[
            { label: 'BMR (resting metabolic rate)', value: `${result.bmr} kcal`, color: 'text-gray-400' },
            { label: `TDEE (${ACTIVITY_LABELS[result.activityLevel]})`, value: `${result.tdee} kcal`, color: 'text-white' },
            { label: 'Daily deficit from TDEE', value: `${result.deficitAmount} kcal`, color: 'text-white' },
            { label: 'Base daily target', value: `${result.targetCalories} kcal`, color: 'text-green-400' },
            { label: 'Protein target', value: `${result.proteinTargetG}g`, color: 'text-white' },
            { label: 'Carbs target', value: `${result.carbsTargetG}g`, color: 'text-white' },
            { label: 'Fat target', value: `${result.fatTargetG}g`, color: 'text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">{label}</span>
              <span className={`font-semibold text-sm ${color}`}>{value}</span>
            </div>
          ))}
          <p className="text-gray-500 text-xs pt-1 border-t border-zinc-800">
            Your daily budget grows as you log steps and workouts.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-3 mb-3">
        {chatHistory.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] ${m.role === 'user' ? 'bg-green-500 text-black rounded-tr-sm' : 'bg-zinc-800 text-gray-200 rounded-tl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 text-gray-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm">Thinking…</div>
          </div>
        )}
      </div>

      <div className="px-6 pb-8 space-y-3">
        <div className="flex gap-2">
          <input value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChatSend()}
            placeholder="Any questions? e.g. 'Can I lose faster?'"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none text-sm" />
          <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
            className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 rounded-xl transition-colors disabled:opacity-40">→</button>
        </div>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button onClick={handleConfirm} disabled={loading}
          className="w-full bg-green-500 text-black font-semibold py-4 rounded-xl disabled:opacity-40 transition-opacity">
          {loading ? 'Saving…' : 'Looks good, start tracking →'}
        </button>
      </div>
    </div>
  )

  return null
}
