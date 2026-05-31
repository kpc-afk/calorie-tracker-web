'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import ChatInput from '@/components/ChatInput'
import ChatMessage, { type Message } from '@/components/ChatMessage'
import SummaryStrip from '@/components/SummaryStrip'
import { todayString } from '@/lib/utils/format'
import { getDailyBudget } from '@/lib/utils/calories'
import type { NutritionResult, UserProfile, DailyActivity, FoodEntry } from '@/lib/db/types'

const WELCOME: Message = {
  type: 'assistant',
  content: "Hi! Log food by describing it or uploading photos, tell me your steps, describe a workout, or ask anything about your nutrition.",
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [activity, setActivity] = useState<DailyActivity | null>(null)
  const today = todayString()
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadContext = useCallback(async () => {
    const [pRes, eRes, aRes] = await Promise.all([
      fetch('/api/profile'),
      fetch(`/api/entries?date=${today}`),
      fetch(`/api/activity?date=${today}`),
    ])
    const [p, e, a] = await Promise.all([pRes.json(), eRes.json(), aRes.json()])
    setProfile(p)
    setEntries(e ?? [])
    setActivity(a)
  }, [today])

  useEffect(() => { loadContext() }, [loadContext])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const totals = entries.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat }),
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

  const chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of messages) {
    if (m.type === 'user') chatHistory.push({ role: 'user', content: m.content })
    else if (m.type === 'assistant') chatHistory.push({ role: 'assistant', content: m.content })
  }

  async function handleSend(message: string, images: File[]) {
    if (!profile) return

    const displayText = message || `[${images.length} photo${images.length > 1 ? 's' : ''}]`
    setMessages(prev => [...prev, { type: 'user', content: displayText }])
    setLoading(true)

    const fd = new FormData()
    fd.append('message', message)
    fd.append('today', today)
    fd.append('todayContext', JSON.stringify({
      caloriesEaten: totals.calories,
      proteinEaten: totals.protein,
      carbsEaten: totals.carbs,
      fatEaten: totals.fat,
      stepsCalories: activity?.steps_calories ?? 0,
      workoutCalories: activity?.workout_calories ?? 0,
    }))
    fd.append('history', JSON.stringify(chatHistory.slice(-10)))
    images.forEach(img => fd.append('images', img))

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Request failed')
      const response = await res.json()
      setMessages(prev => [...prev, { type: 'ai_response', response, date: today }])
    } catch {
      setMessages(prev => [...prev, { type: 'assistant', content: 'Something went wrong. Please try again.' }])
    }
    setLoading(false)
  }

  async function handleFoodAdded(items: NutritionResult[], date: string) {
    await Promise.all(items.map(item =>
      fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          name: item.name,
          brand: item.brand,
          serving_size: item.serving_size,
          serving_unit: item.serving_unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          sugar: item.sugar,
          sodium: item.sodium,
          saturated_fat: item.saturated_fat,
          cholesterol: item.cholesterol,
          commentary: item.commentary,
          source: 'ai_search',
        }),
      })
    ))
    loadContext()
  }

  async function handleWorkoutAdded(kcal: number, date: string) {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        workout_calories: (activity?.workout_calories ?? 0) + kcal,
      }),
    })
    loadContext()
  }

  async function handleStepsAdded(steps: number, stepsCalories: number, date: string) {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, steps_count: steps, steps_calories: stepsCalories }),
    })
    loadContext()
  }

  return (
    <div className="flex flex-col h-full">
      <SummaryStrip budget={budget} eaten={totals.calories} />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <ChatMessage key={i} message={m}
            onFoodAdded={handleFoodAdded}
            onWorkoutAdded={handleWorkoutAdded}
            onStepsAdded={handleStepsAdded} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 text-gray-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  )
}
