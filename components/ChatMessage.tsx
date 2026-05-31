'use client'
import { useState } from 'react'
import FoodItemCard from './FoodItemCard'
import WorkoutCard from './WorkoutCard'
import StepsCard from './StepsCard'
import type { ChatResponse, NutritionResult } from '@/lib/db/types'

export type TextMessage = { type: 'user' | 'assistant'; content: string }
export type AIResponseMessage = { type: 'ai_response'; response: ChatResponse; date: string }
export type Message = TextMessage | AIResponseMessage

type Props = {
  message: Message
  onFoodAdded: (items: NutritionResult[], date: string) => void
  onWorkoutAdded: (kcal: number, date: string) => void
  onStepsAdded: (steps: number, kcal: number, date: string) => void
}

export default function ChatMessage({ message, onFoodAdded, onWorkoutAdded, onStepsAdded }: Props) {
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set())
  const [allAdded, setAllAdded] = useState(false)
  const [workoutAdded, setWorkoutAdded] = useState(false)
  const [stepsAdded, setStepsAdded] = useState(false)
  const [localItems, setLocalItems] = useState<NutritionResult[]>(
    message.type === 'ai_response' && message.response.intent === 'food_log'
      ? [...message.response.items]
      : []
  )

  if (message.type === 'user') return (
    <div className="flex justify-end">
      <div className="bg-green-500 text-black rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
        {message.content}
      </div>
    </div>
  )

  if (message.type === 'assistant') return (
    <div className="flex justify-start">
      <div className="bg-zinc-800 text-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  )

  const { response, date } = message as AIResponseMessage

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
          onAdd={() => { onFoodAdded([localItems[i]], date); setAddedItems(prev => new Set([...prev, i])) }}
          added={addedItems.has(i)} />
      ))}
      {localItems.length > 1 && !allAdded && (
        <button onClick={() => {
          const notYet = localItems.filter((_, i) => !addedItems.has(i))
          if (notYet.length > 0) onFoodAdded(notYet, date)
          setAllAdded(true)
          setAddedItems(new Set(localItems.map((_, i) => i)))
        }}
          className="w-full bg-green-500 text-black font-semibold py-3 rounded-xl text-sm">
          Add all {localItems.length} items
        </button>
      )}
    </div>
  )

  if (response.intent === 'workout') return (
    <WorkoutCard
      activeCalories={response.activeCalories}
      message={response.message}
      onAdd={() => { onWorkoutAdded(response.activeCalories, date); setWorkoutAdded(true) }}
      added={workoutAdded}
    />
  )

  if (response.intent === 'steps') return (
    <StepsCard
      steps={response.steps}
      stepsCalories={response.stepsCalories}
      message={response.message}
      onAdd={() => { onStepsAdded(response.steps, response.stepsCalories, date); setStepsAdded(true) }}
      added={stepsAdded}
    />
  )

  return null
}
