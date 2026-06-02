'use client'
import { useState } from 'react'
import FoodItemCard from './FoodItemCard'
import WorkoutCard from './WorkoutCard'
import StepsCard from './StepsCard'
import type { ChatResponse, NutritionResult, ProfileUpdateFields } from '@/lib/db/types'

export type TextMessage = { type: 'user' | 'assistant'; content: string; imageUrls?: string[]; retryable?: boolean }
export type AIResponseMessage = { type: 'ai_response'; response: ChatResponse; date: string }
export type Message = TextMessage | AIResponseMessage

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
      <div className="max-w-[80%] space-y-1">
        {message.imageUrls && message.imageUrls.length > 0 && (
          <div className={`grid gap-1 ${message.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {message.imageUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="rounded-xl object-cover w-full"
                style={{ maxHeight: 200, minHeight: 80 }} />
            ))}
          </div>
        )}
        {message.content && (
          <div className="bg-green-500 text-black rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
            {message.content}
          </div>
        )}
      </div>
    </div>
  )

  if (message.type === 'assistant') return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        <div className="bg-zinc-800 text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
        {message.retryable && onRetry && (
          <button onClick={onRetry}
            className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            Retry
          </button>
        )}
      </div>
    </div>
  )

  const { response } = message as AIResponseMessage

  if (response.intent === 'question') return (
    <div className="flex justify-start">
      <div className="bg-zinc-800 text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
        {response.message}
      </div>
    </div>
  )

  if (response.intent === 'food_log') return (
    <div className="space-y-2">
      <div className="flex justify-start">
        <div className="bg-zinc-800 text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm">{response.message}</div>
      </div>
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
          className="w-full bg-green-500 text-black font-semibold py-3 rounded-xl text-sm">
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
              className="flex-1 bg-zinc-800 text-white text-sm rounded-xl px-3 py-2 focus:outline-none border border-zinc-700 focus:border-zinc-500"
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
              className="bg-zinc-700 text-white text-sm font-semibold px-3 py-2 rounded-xl disabled:opacity-40">
              Save
            </button>
            <button onClick={() => setShowSaveMeal(false)} className="text-zinc-500 hover:text-zinc-300 text-sm px-2">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowSaveMeal(true)}
            className="text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors">
            + Save as meal template
          </button>
        )
      )}
      {mealSaved && <div className="text-zinc-500 text-xs">✓ Saved as meal template</div>}
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
    <div className="space-y-2">
      <div className="flex justify-start">
        <div className="bg-zinc-800 text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
          {response.message}
        </div>
      </div>
      {!profileUpdated && (
        <div className="flex gap-2">
          <button
            onClick={() => { setProfileUpdated(true); onProfileUpdated(response.updates) }}
            className="flex-1 bg-green-500 text-black font-semibold py-3 rounded-xl text-sm">
            Confirm
          </button>
          <button
            onClick={() => { setProfileUpdated(true); onProfileUpdateCancelled() }}
            className="flex-1 bg-zinc-700 text-gray-200 font-semibold py-3 rounded-xl text-sm">
            Cancel
          </button>
        </div>
      )}
    </div>
  )

  return null
}
