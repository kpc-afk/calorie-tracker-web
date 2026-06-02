'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import ChatInput from '@/components/ChatInput'
import ChatMessage, { type Message } from '@/components/ChatMessage'
import SummaryStrip from '@/components/SummaryStrip'
import FavoritesStrip from '@/components/FavoritesStrip'
import { todayString, offsetDate, formatDisplayDate } from '@/lib/utils/format'
import { incrementRequestCount } from '@/app/(app)/settings/page'
import { getDailyBudget, calculateBMR, calculateTDEE } from '@/lib/utils/calories'
import type { NutritionResult, UserProfile, DailyActivity, FoodEntry, ProfileUpdateFields } from '@/lib/db/types'

const WELCOME: Message = {
  type: 'assistant',
  content: "Hi! Log food by describing it or uploading photos, tell me your steps, describe a workout, or ask anything about your nutrition.",
}

const SEED_PROFILE = {
  date_of_birth: '1994-12-14',
  sex: 'male' as const,
  height_cm: 172,
  weight_kg: 83,
  height_unit: 'cm' as const,
  weight_unit: 'kg' as const,
  goal: 'lose' as const,
  activity_level: 'sedentary' as const,
  bmr: 1755,
  tdee: 2100,
  deficit_amount: 600,
  target_calories: 1500,
  protein_target_g: 130,
  carbs_target_g: 150,
  fat_target_g: 42,
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [WELCOME]
    try {
      const saved = localStorage.getItem('chat_history')
      if (saved) {
        const parsed = JSON.parse(saved) as Message[]
        return parsed.length > 0 ? parsed : [WELCOME]
      }
    } catch { /* ignore */ }
    return [WELCOME]
  })
  const [loading, setLoading] = useState(false)
  const [favRefreshKey, setFavRefreshKey] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilter, setSearchFilter] = useState<'all' | 'food' | 'workout' | 'steps'>('all')
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [pullY, setPullY] = useState(0)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const lastRequestRef = useRef<{ message: string; compressedImages: File[] } | null>(null)
  const initialCountRef = useRef(messages.length)

  const RECENT_COUNT = 20
  const PULL_THRESHOLD = 60

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e: React.TouchEvent) {
    const el = scrollRef.current
    if (!el || el.scrollTop > 2 || historyExpanded) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setPullY(Math.min(delta * 0.5, 80))
  }

  function handleTouchEnd() {
    if (pullY >= PULL_THRESHOLD) {
      setHistoryExpanded(true)
      setTimeout(() => scrollToBottom(), 50)
    }
    setPullY(0)
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollToBottom(distFromBottom > 120)
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileChecked, setProfileChecked] = useState(false)
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [activity, setActivity] = useState<DailyActivity | null>(null)
  const [logDate, setLogDate] = useState(todayString)
  const today = todayString()
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadContext = useCallback(async (date?: string) => {
    const d = date ?? logDate
    const [pRes, eRes, aRes] = await Promise.all([
      fetch('/api/profile'),
      fetch(`/api/entries?date=${d}`),
      fetch(`/api/activity?date=${d}`),
    ])
    const [p, e, a] = await Promise.all([pRes.json(), eRes.json(), aRes.json()])
    if (!p) {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SEED_PROFILE),
      })
      const seeded = await fetch('/api/profile').then(r => r.json())
      if (!seeded) return
      setProfile(seeded)
      setProfileChecked(true)
      setEntries([])
      setActivity(null)
      return
    }
    setProfile(p)
    setProfileChecked(true)
    setEntries(e ?? [])
    setActivity(a)
  }, [logDate])

  useEffect(() => { loadContext() }, [loadContext])

  function changeDate(newDate: string) {
    setLogDate(newDate)
  }
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Persist messages — strip imageUrls (object URLs don't survive page reload)
    const toSave = messages.map(m =>
      m.type === 'user' ? { ...m, imageUrls: undefined } : m
    )
    localStorage.setItem('chat_history', JSON.stringify(toSave))
  }, [messages])

  const totals = entries.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const budget = profile
    ? getDailyBudget({
        tdee: (profile.tdee || Math.round(profile.bmr * 1.2)),
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

  async function compressImage(file: File, maxPx = 768, quality = 0.80): Promise<File> {
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        // Keep both dimensions ≤768px so Gemini uses 1 tile (258 tokens) instead of 2-6
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
        }, 'image/jpeg', quality)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  async function handleSend(message: string, images: File[]) {
    if (!profile) return

    const displayText = images.length > 0 && !message ? '' : message
    setMessages(prev => [...prev, {
      type: 'user',
      content: displayText,
      imageUrls: images.length > 0 ? images.map(f => URL.createObjectURL(f)) : undefined,
    }])
    setLoading(true)

    const compressed = await Promise.all(images.map(img => compressImage(img)))
    lastRequestRef.current = { message, compressedImages: compressed }

    const fd = new FormData()
    fd.append('message', message)
    fd.append('today', logDate)
    fd.append('todayContext', JSON.stringify({
      caloriesEaten: totals.calories,
      proteinEaten: totals.protein,
      carbsEaten: totals.carbs,
      fatEaten: totals.fat,
      stepsCalories: activity?.steps_calories ?? 0,
      workoutCalories: activity?.workout_calories ?? 0,
    }))
    fd.append('history', JSON.stringify(chatHistory.slice(-10)))
    compressed.forEach(img => fd.append('images', img))

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: fd })
      if (res.status === 429) {
        setMessages(prev => [...prev, { type: 'assistant', content: 'Rate limit hit — try again in about a minute. If it keeps failing, you may have hit the daily cap (500 requests) which resets at midnight.', retryable: true }])
        setLoading(false)
        return
      }
      if (res.status === 503) {
        setMessages(prev => [...prev, { type: 'assistant', content: 'Gemini is experiencing high demand right now — wait a few seconds and try again.', retryable: true }])
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error('Request failed')
      const response = await res.json()
      incrementRequestCount()
      lastRequestRef.current = null
      setMessages(prev => [...prev, { type: 'ai_response', response, date: logDate }])
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

  async function handleProfileUpdated(updates: ProfileUpdateFields) {
    if (!profile) return

    const merged = { ...profile, ...updates }

    // Recalculate BMR + TDEE whenever weight changes
    if (updates.weight_kg !== undefined) {
      merged.bmr = calculateBMR({
        weightKg: updates.weight_kg,
        heightCm: profile.height_cm,
        dateOfBirth: profile.date_of_birth,
        sex: profile.sex,
      })
      merged.tdee = calculateTDEE(merged.bmr, profile.activity_level ?? 'sedentary')
    }

    const tdee = updates.tdee ?? merged.tdee ?? Math.round(profile.bmr * 1.2)
    const derived: ProfileUpdateFields = { ...updates, bmr: merged.bmr, tdee }
    if (updates.target_calories !== undefined && updates.deficit_amount === undefined) {
      derived.deficit_amount = tdee - updates.target_calories
    } else if (updates.deficit_amount !== undefined && updates.target_calories === undefined) {
      derived.target_calories = tdee - updates.deficit_amount
    } else if (updates.weight_kg !== undefined) {
      // Weight changed — keep deficit_amount, recalculate target_calories
      derived.target_calories = tdee - (profile.deficit_amount ?? 0)
    }
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, ...derived }),
    })
    await loadContext()
    setMessages(prev => [...prev, { type: 'assistant', content: 'Done. Your profile has been updated.' }])
  }

  function handleProfileUpdateCancelled() {
    setMessages(prev => [...prev, { type: 'assistant', content: 'Okay, no changes made.' }])
  }

  async function handleRetry() {
    if (!lastRequestRef.current || loading) return
    const { message, compressedImages } = lastRequestRef.current

    // Build history from current messages excluding the error message (last one)
    const historyForRetry: { role: 'user' | 'assistant'; content: string }[] = []
    for (const m of messages.slice(0, -1)) {
      if (m.type === 'user') historyForRetry.push({ role: 'user', content: m.content })
      else if (m.type === 'assistant') historyForRetry.push({ role: 'assistant', content: m.content })
    }

    setMessages(prev => prev.slice(0, -1))
    setLoading(true)

    const fd = new FormData()
    fd.append('message', message)
    fd.append('today', logDate)
    fd.append('todayContext', JSON.stringify({
      caloriesEaten: totals.calories,
      proteinEaten: totals.protein,
      carbsEaten: totals.carbs,
      fatEaten: totals.fat,
      stepsCalories: activity?.steps_calories ?? 0,
      workoutCalories: activity?.workout_calories ?? 0,
    }))
    fd.append('history', JSON.stringify(historyForRetry.slice(-10)))
    compressedImages.forEach(img => fd.append('images', img))

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: fd })
      if (res.status === 429) {
        setMessages(prev => [...prev, { type: 'assistant', content: 'Still rate limited — wait a minute and try again.', retryable: true }])
        setLoading(false)
        return
      }
      if (res.status === 503) {
        setMessages(prev => [...prev, { type: 'assistant', content: 'Gemini is experiencing high demand right now — wait a few seconds and try again.', retryable: true }])
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error('Request failed')
      const response = await res.json()
      incrementRequestCount()
      lastRequestRef.current = null
      setMessages(prev => [...prev, { type: 'ai_response', response, date: logDate }])
    } catch {
      setMessages(prev => [...prev, { type: 'assistant', content: 'Something went wrong. Please try again.' }])
    }
    setLoading(false)
  }

  if (!profileChecked) return (
    <div className="flex flex-col h-full items-center justify-center">
      <div className="text-gray-500 text-sm">Loading…</div>
    </div>
  )

  const isToday = logDate === today

  function matchesSearch(m: Message): boolean {
    const q = searchQuery.trim().toLowerCase()

    if (searchFilter !== 'all') {
      if (m.type !== 'ai_response') return false
      if (searchFilter === 'food' && m.response.intent !== 'food_log') return false
      if (searchFilter === 'workout' && m.response.intent !== 'workout') return false
      if (searchFilter === 'steps' && m.response.intent !== 'steps') return false
    }

    if (!q) return true

    if (m.type === 'user') return m.content.toLowerCase().includes(q)
    if (m.type === 'assistant') return m.content.toLowerCase().includes(q)
    if (m.type === 'ai_response') {
      const r = m.response
      if (r.intent === 'food_log') return r.items.some(item => item.name.toLowerCase().includes(q)) || r.message.toLowerCase().includes(q)
      return r.message.toLowerCase().includes(q)
    }
    return false
  }

  const allVisible = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => matchesSearch(m))

  const isSearching = searchOpen && (searchQuery.trim() !== '' || searchFilter !== 'all')

  // welcomeEntry = the WELCOME message (index 0, always visible)
  // historyEntries = messages that existed on page load (hidden until expanded)
  // currentEntries = messages sent this session (always visible)
  const welcomeEntry = allVisible.find(({ i }) => i === 0)
  const historyEntries = allVisible.filter(({ i }) => i > 0 && i < initialCountRef.current)
  const currentEntries = allVisible.filter(({ i }) => i >= initialCountRef.current)
  const displayHistory = (isSearching || historyExpanded) ? historyEntries : []
  const hiddenCount = historyEntries.length - displayHistory.length

  return (
    <div className="flex flex-col h-full">
      {/* Date nav */}
      <div className="shrink-0 bg-zinc-950 border-b border-zinc-800/60">
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={() => changeDate(offsetDate(logDate, -1))}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white bg-zinc-800 rounded-xl text-lg transition-colors">
            ‹
          </button>
          <div className="text-center">
            <div className="text-white font-semibold text-sm">{formatDisplayDate(logDate)}</div>
            {!isToday && <div className="text-zinc-500 text-xs">logging for past day</div>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => changeDate(offsetDate(logDate, 1))} disabled={isToday}
              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white bg-zinc-800 rounded-xl text-lg transition-colors disabled:opacity-30">
              ›
            </button>
            <button
              onClick={() => {
                const opening = !searchOpen
                setSearchOpen(opening)
                if (opening) setTimeout(() => searchRef.current?.focus(), 50)
                else { setSearchQuery(''); setSearchFilter('all') }
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-xl text-base transition-colors ${searchOpen ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              ⌕
            </button>
          </div>
        </div>
        {searchOpen && (
          <div className="px-4 pb-3 space-y-2">
            <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2">
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search meals, workouts…"
                className="flex-1 bg-transparent text-white text-sm placeholder-zinc-500 focus:outline-none"
              />
              {searchQuery
                ? <button onClick={() => setSearchQuery('')} className="text-zinc-400 text-xs px-1">✕</button>
                : null}
            </div>
            <div className="flex gap-2">
              {(['all', 'food', 'workout', 'steps'] as const).map(f => (
                <button key={f} onClick={() => setSearchFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${searchFilter === f ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                  {f === 'all' ? 'All' : f === 'food' ? 'Food' : f === 'workout' ? 'Workout' : 'Steps'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <SummaryStrip budget={budget} eaten={totals.calories} />
      <div className="flex-1 relative min-h-0">
      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-zinc-700 text-white shadow-lg hover:bg-zinc-600 transition-colors text-base">
          ↓
        </button>
      )}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto p-4 space-y-3"
        style={{ overscrollBehaviorY: 'contain' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onScroll={handleScroll}
      >
        {/* Pull-to-expand indicator */}
        {pullY > 0 && (
          <div className="flex justify-center pb-1" style={{ marginTop: pullY - 24 }}>
            <div className={`text-xs px-3 py-1 rounded-full transition-colors ${pullY >= PULL_THRESHOLD ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
              {pullY >= PULL_THRESHOLD ? 'Release to show history' : 'Pull to show history'}
            </div>
          </div>
        )}

        {/* Welcome message — always visible, with ↑/↓ button to its right when history exists */}
        {welcomeEntry && (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <ChatMessage message={welcomeEntry.m} logDate={logDate}
                onFoodAdded={handleFoodAdded} onWorkoutAdded={handleWorkoutAdded}
                onStepsAdded={handleStepsAdded} onProfileUpdated={handleProfileUpdated}
                onProfileUpdateCancelled={handleProfileUpdateCancelled} onRetry={handleRetry} />
            </div>
            {!isSearching && (hiddenCount > 0 || historyExpanded) && (
              <button
                onClick={() => {
                  if (historyExpanded) {
                    setHistoryExpanded(false)
                    scrollToBottom()
                  } else {
                    setHistoryExpanded(true)
                    setTimeout(() => scrollToBottom(), 50)
                  }
                }}
                title={historyExpanded ? 'Collapse history' : `Show ${hiddenCount} older messages`}
                className="shrink-0 mt-1 w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors text-xs">
                {historyExpanded ? '↓' : '↑'}
              </button>
            )}
          </div>
        )}

        {/* History messages (hidden until expanded) */}
        {displayHistory.map(({ m, i }) => (
          <ChatMessage key={i} message={m}
            logDate={logDate}
            isHistory
            onFoodAdded={handleFoodAdded}
            onWorkoutAdded={handleWorkoutAdded}
            onStepsAdded={handleStepsAdded}
            onProfileUpdated={handleProfileUpdated}
            onProfileUpdateCancelled={handleProfileUpdateCancelled}
            onRetry={handleRetry} />
        ))}

        {/* Collapse button at the bottom of expanded history */}
        {!isSearching && historyExpanded && historyEntries.length > 0 && (
          <button
            onClick={() => { setHistoryExpanded(false); scrollToBottom() }}
            className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1.5 transition-colors">
            ↑ Collapse history
          </button>
        )}

        {/* Current session messages (always visible) */}
        {currentEntries.map(({ m, i }) => (
          <ChatMessage key={i} message={m}
            logDate={logDate}
            onFoodAdded={handleFoodAdded}
            onWorkoutAdded={handleWorkoutAdded}
            onStepsAdded={handleStepsAdded}
            onProfileUpdated={handleProfileUpdated}
            onProfileUpdateCancelled={handleProfileUpdateCancelled}
            onRetry={handleRetry} />
        ))}
        {isSearching && allVisible.length === 0 && (
          <div className="text-center text-zinc-500 text-sm pt-8">No results found</div>
        )}
        {!isSearching && loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 text-gray-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      </div>
      {!searchOpen && (
        <div className="shrink-0">
          <FavoritesStrip
            refreshKey={favRefreshKey}
            onAdd={(name) => {
              setFavRefreshKey(k => k + 1)
              const msg: Message = { type: 'assistant', content: `✓ Added **${name}** to today's log.` }
              setMessages(prev => [...prev, msg])
            }}
          />
          <ChatInput onSend={handleSend} disabled={loading} />
        </div>
      )}
    </div>
  )
}
