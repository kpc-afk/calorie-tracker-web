'use client'
import { useState } from 'react'
import FoodItemCard from './FoodItemCard'
import WorkoutCard from './WorkoutCard'
import StepsCard from './StepsCard'
import { haptic } from '@/lib/utils/haptic'
import type { ChatResponse, NutritionResult, ProfileUpdateFields } from '@/lib/db/types'

export type TextMessage = { type: 'user' | 'assistant'; content: string; imageUrls?: string[] }
export type AIResponseMessage = { type: 'ai_response'; response: ChatResponse; date: string }
export type ErrorKind = 'rate_limit' | 'overloaded' | 'other'
export type ErrorMessage = { type: 'error'; kind: ErrorKind }
export type Message = TextMessage | AIResponseMessage | ErrorMessage

const ERROR_COPY: Record<ErrorKind, string> = {
  rate_limit: 'Gemini free-tier limit hit — wait ~30s.',
  overloaded: 'Gemini is busy right now.',
  other: 'Something went wrong.',
}

type Props = {
  message: Message
  logDate: string
  isHistory?: boolean
  onFoodAdded: (items: NutritionResult[], date: string) => void
  onWorkoutAdded: (kcal: number, date: string) => void
  onStepsAdded: (steps: number, kcal: number, date: string) => void
  onProfileUpdated: (updates: ProfileUpdateFields) => void
  onProfileUpdateCancelled: () => void
  onRetry?: () => void
  onTemplateSaved?: () => void
}

export default function ChatMessage({ message, logDate, isHistory, onFoodAdded, onWorkoutAdded, onStepsAdded, onProfileUpdated, onProfileUpdateCancelled, onRetry, onTemplateSaved }: Props) {
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set())
  const [allAdded, setAllAdded] = useState(false)
  const [workoutAdded, setWorkoutAdded] = useState(false)
  const [stepsAdded, setStepsAdded] = useState(false)
  const [profileUpdated, setProfileUpdated] = useState(false)
  const [localItems, setLocalItems] = useState<NutritionResult[]>(
    message.type === 'ai_response' && message.response.intent === 'food_log'
      ? [...message.response.items]
      : []
  )
  const [showSaveMeal, setShowSaveMeal] = useState(false)
  const [mealName, setMealName] = useState('')
  const [mealSaved, setMealSaved] = useState(false)

  if (message.type === 'user') return (
    <div className="flex justify-end">
      <div className="max-w-[80%] space-y-1.5">
        {message.imageUrls && message.imageUrls.length > 0 && (
          <div className={`grid gap-1 ${message.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {message.imageUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="rounded-[var(--radius)] object-cover w-full border border-[var(--hairline)]"
                style={{ maxHeight: 200, minHeight: 80 }} />
            ))}
          </div>
        )}
        {message.content && (
          <div className="text-[var(--ink-60)] text-[15px] leading-relaxed text-right">
            {message.content}
          </div>
        )}
      </div>
    </div>
  )

  if (message.type === 'assistant') return (
    <div className="pl-3 border-l border-[var(--hairline)] text-[var(--ink)] text-[15px] leading-relaxed whitespace-pre-wrap">
      {message.content}
    </div>
  )

  if (message.type === 'error') return (
    <div className="pl-3 border-l border-[var(--danger)] space-y-2">
      <div className="text-[var(--ink-60)] text-[15px]">{ERROR_COPY[message.kind]}</div>
      {onRetry && (
        <button onClick={() => { haptic('light'); onRetry() }}
          className="border border-[var(--hairline)] hover:border-[var(--hairline-strong)] text-[var(--ink)] text-sm font-medium px-4 py-2 rounded-[var(--radius)] transition-colors">
          Tap to retry
        </button>
      )}
    </div>
  )

  const { response } = message as AIResponseMessage

  if (response.intent === 'question') return (
    <div className="pl-3 border-l border-[var(--hairline)] text-[var(--ink)] text-[15px] leading-relaxed whitespace-pre-wrap">
      {response.message}
    </div>
  )

  if (response.intent === 'food_log') return (
    <div className="space-y-3">
      <div className="pl-3 border-l border-[var(--hairline)] text-[var(--ink)] text-[15px] leading-relaxed">{response.message}</div>
      {localItems.map((item, i) => (
        <FoodItemCard key={i} item={item}
          onChange={updated => setLocalItems(prev => prev.map((it, idx) => idx === i ? updated : it))}
          onAdd={() => { onFoodAdded([localItems[i]], logDate); if (!isHistory) setAddedItems(prev => new Set([...prev, i])) }}
          added={!isHistory && addedItems.has(i)}
          addLabel={isHistory ? `Add to ${logDate}` : undefined} />
      ))}
      {localItems.length > 1 && (isHistory || !allAdded) && (
        <button onClick={() => {
          const notYet = isHistory ? localItems : localItems.filter((_, i) => !addedItems.has(i))
          if (notYet.length > 0) onFoodAdded(notYet, logDate)
          if (!isHistory) { setAllAdded(true); setAddedItems(new Set(localItems.map((_, i) => i))) }
        }}
          className="w-full bg-[var(--accent)] text-[var(--accent-ink)] font-semibold py-3 rounded-[var(--radius)] text-sm">
          {isHistory ? `Add all ${localItems.length} to ${logDate}` : `Add all ${localItems.length} items`}
        </button>
      )}
      {!isHistory && !mealSaved && localItems.length >= 2 && (
        showSaveMeal ? (
          <div className="flex gap-2 items-center">
            <input
              value={mealName}
              onChange={e => setMealName(e.target.value)}
              placeholder="Meal name (e.g. Chicken Bowl)"
              className="flex-1 bg-transparent text-[var(--ink)] text-sm rounded-[var(--radius)] px-3 py-2 focus:outline-none border border-[var(--hairline)] focus:border-[var(--hairline-strong)]"
              autoFocus
            />
            <button
              onClick={async () => {
                if (!mealName.trim()) return
                await fetch('/api/templates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: mealName.trim(), items: localItems }),
                })
                setMealSaved(true)
                setShowSaveMeal(false)
                onTemplateSaved?.()
              }}
              disabled={!mealName.trim()}
              className="border border-[var(--hairline)] text-[var(--ink)] text-sm font-medium px-3 py-2 rounded-[var(--radius)] disabled:opacity-40">
              Save
            </button>
            <button onClick={() => setShowSaveMeal(false)} className="text-[var(--ink-60)] hover:text-[var(--ink)] text-sm px-2 transition-colors">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowSaveMeal(true)}
            className="text-[var(--ink-60)] hover:text-[var(--ink)] text-xs font-medium transition-colors">
            + Save as meal template
          </button>
        )
      )}
      {mealSaved && <div className="text-[11px] tnum text-[var(--accent)]">✓ Saved as meal template</div>}
    </div>
  )

  if (response.intent === 'workout') return (
    <WorkoutCard
      activeCalories={response.activeCalories}
      message={response.message}
      onAdd={() => { onWorkoutAdded(response.activeCalories, logDate); setWorkoutAdded(true) }}
      added={workoutAdded}
    />
  )

  if (response.intent === 'steps') return (
    <StepsCard
      steps={response.steps}
      stepsCalories={response.stepsCalories}
      message={response.message}
      onAdd={() => { onStepsAdded(response.steps, response.stepsCalories, logDate); setStepsAdded(true) }}
      added={stepsAdded}
    />
  )

  if (response.intent === 'profile_update_pending') return (
    <div className="space-y-3">
      <div className="pl-3 border-l border-[var(--hairline)] text-[var(--ink)] text-[15px] leading-relaxed whitespace-pre-wrap">
        {response.message}
      </div>
      {!profileUpdated && (
        <div className="flex gap-2">
          <button
            onClick={() => { setProfileUpdated(true); onProfileUpdated(response.updates) }}
            className="flex-1 bg-[var(--accent)] text-[var(--accent-ink)] font-semibold py-3 rounded-[var(--radius)] text-sm">
            Confirm
          </button>
          <button
            onClick={() => { setProfileUpdated(true); onProfileUpdateCancelled() }}
            className="flex-1 border border-[var(--hairline)] text-[var(--ink)] font-semibold py-3 rounded-[var(--radius)] text-sm">
            Cancel
          </button>
        </div>
      )}
    </div>
  )

  return null
}
