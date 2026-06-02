'use client'
import { useState, useRef } from 'react'
import type { NutritionResult } from '@/lib/db/types'
import { haptic } from '@/lib/utils/haptic'

type Props = {
  item: NutritionResult
  onChange: (updated: NutritionResult) => void
  onAdd: () => void
  added: boolean
  addLabel?: string
}

const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const

function scale(item: NutritionResult, servings: number): NutritionResult {
  if (servings === 1) return item
  return {
    ...item,
    calories: Math.round(item.calories * servings * 10) / 10,
    protein: Math.round(item.protein * servings * 10) / 10,
    carbs: Math.round(item.carbs * servings * 10) / 10,
    fat: Math.round(item.fat * servings * 10) / 10,
    fiber: Math.round(item.fiber * servings * 10) / 10,
    sugar: Math.round(item.sugar * servings * 10) / 10,
    sodium: Math.round(item.sodium * servings * 10) / 10,
    saturated_fat: Math.round(item.saturated_fat * servings * 10) / 10,
    cholesterol: Math.round(item.cholesterol * servings * 10) / 10,
  }
}

export default function FoodItemCard({ item, onChange, onAdd, added, addLabel }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [servings, setServings] = useState(1)
  const [servingsInput, setServingsInput] = useState('1')
  const [showAskAI, setShowAskAI] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState('')
  const baseItem = useRef<NutritionResult>(item)

  function applyServings(n: number) {
    const clamped = Math.max(0.25, Math.min(n, 20))
    setServings(clamped)
    setServingsInput(String(clamped))
    onChange(scale(baseItem.current, clamped))
  }

  function handleServingsInput(val: string) {
    setServingsInput(val)
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) {
      const clamped = Math.max(0.25, Math.min(n, 20))
      setServings(clamped)
      onChange(scale(baseItem.current, clamped))
    }
  }

  function update(key: keyof NutritionResult, val: string | number) {
    const updated = { ...item, [key]: typeof item[key] === 'number' ? Number(val) : val }
    baseItem.current = scale(updated, 1 / servings) // keep base in sync when manually editing
    onChange(updated)
  }

  async function handleAskAI() {
    if (!aiQuestion.trim()) return
    setAiLoading(true)
    setAiExplanation('')
    try {
      const res = await fetch('/api/serving-size', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodName: item.name,
          servingSize: item.serving_size,
          servingUnit: item.serving_unit,
          question: aiQuestion,
        }),
      })
      const data = await res.json()
      if (data.servings) {
        applyServings(data.servings)
        setAiExplanation(data.explanation)
        setShowAskAI(false)
        setAiQuestion('')
        haptic('medium')
      } else {
        setAiExplanation("Couldn't figure that out — try being more specific, e.g. \"I ate 5 pieces\"")
      }
    } catch {
      setAiExplanation('Something went wrong, try again.')
    }
    setAiLoading(false)
  }

  const displayed = scale(baseItem.current, servings)
  const proteinKcal = displayed.protein * 4
  const carbsKcal = displayed.carbs * 4
  const fatKcal = displayed.fat * 9
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal

  return (
    <div className={`bg-zinc-800 rounded-2xl p-4 border transition-opacity ${added ? 'border-green-700 opacity-60' : 'border-zinc-700'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <input value={item.name} onChange={e => update('name', e.target.value)}
            className="bg-transparent text-white font-semibold text-sm w-full focus:outline-none border-b border-transparent focus:border-zinc-600 pb-0.5" />
          <div className="text-zinc-500 text-xs mt-0.5">{item.serving_size} {item.serving_unit} per serving</div>
        </div>
        <div className="text-green-400 font-bold text-xl shrink-0">
          {Math.round(displayed.calories)}
          <span className="text-xs font-normal text-zinc-500 ml-0.5">kcal</span>
        </div>
      </div>

      {/* Macro row */}
      <div className="flex gap-3 text-xs mb-2">
        <span className="font-semibold text-emerald-400">{Math.round(displayed.protein)}g <span className="text-zinc-600 font-normal">P</span></span>
        <span className="font-semibold text-blue-400">{Math.round(displayed.carbs)}g <span className="text-zinc-600 font-normal">C</span></span>
        <span className="font-semibold text-orange-400">{Math.round(displayed.fat)}g <span className="text-zinc-600 font-normal">F</span></span>
      </div>

      {/* Macro proportion bar */}
      {totalMacroKcal > 0 && (
        <div className="h-1 bg-zinc-700 rounded-full overflow-hidden flex mb-3">
          <div style={{ width: `${(proteinKcal / totalMacroKcal) * 100}%`, backgroundColor: '#10b981' }} />
          <div style={{ width: `${(carbsKcal / totalMacroKcal) * 100}%`, backgroundColor: '#3b82f6' }} />
          <div style={{ width: `${(fatKcal / totalMacroKcal) * 100}%`, backgroundColor: '#f97316' }} />
        </div>
      )}

      {/* Serving multiplier */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-zinc-500 text-xs">Servings:</span>
        <button onClick={() => applyServings(Math.max(0.25, servings - 0.5))}
          className="w-6 h-6 rounded-full bg-zinc-700 text-white text-sm flex items-center justify-center hover:bg-zinc-600 transition-colors">
          −
        </button>
        <input
          type="number"
          value={servingsInput}
          onChange={e => handleServingsInput(e.target.value)}
          onBlur={() => setServingsInput(String(servings))}
          className="w-14 bg-zinc-900 text-white text-xs text-center rounded-lg px-2 py-1 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          step="0.5"
          min="0.25"
          max="20"
        />
        <button onClick={() => applyServings(servings + 0.5)}
          className="w-6 h-6 rounded-full bg-zinc-700 text-white text-sm flex items-center justify-center hover:bg-zinc-600 transition-colors">
          +
        </button>
        <button
          onClick={() => { setShowAskAI(v => !v); setAiExplanation('') }}
          className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
          Ask AI ✦
        </button>
      </div>

      {/* AI explanation after a successful query */}
      {aiExplanation && !showAskAI && (
        <p className="text-zinc-500 text-xs mb-2 italic">✦ {aiExplanation}</p>
      )}

      {/* Ask AI inline form */}
      {showAskAI && (
        <div className="mb-3 space-y-2">
          <input
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAskAI()}
            placeholder={`e.g. "I ate 5 nuggets" or "about 200g"`}
            className="w-full bg-zinc-900 text-white text-xs rounded-xl px-3 py-2 border border-zinc-700 focus:outline-none focus:border-blue-500 placeholder-zinc-600"
            autoFocus
          />
          {aiExplanation && (
            <p className="text-zinc-500 text-xs italic">{aiExplanation}</p>
          )}
          <div className="flex gap-2">
            <button onClick={handleAskAI} disabled={!aiQuestion.trim() || aiLoading}
              className="flex-1 bg-blue-500 text-white text-xs font-bold py-2 rounded-xl disabled:opacity-40">
              {aiLoading ? 'Calculating…' : 'Calculate servings'}
            </button>
            <button onClick={() => { setShowAskAI(false); setAiExplanation('') }}
              className="px-3 py-2 rounded-xl bg-zinc-700 text-zinc-400 text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      {item.commentary && (
        <p className="text-zinc-500 text-xs mb-3 italic leading-relaxed">{item.commentary}</p>
      )}

      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {expanded ? 'Less ▲' : 'Edit fields ▼'}
        </button>
        <div className="flex-1" />
        {added
          ? <span className="text-green-500 text-xs font-medium">✓ Added</span>
          : <button onClick={() => { haptic('medium'); onAdd() }} className="bg-green-500 text-black text-xs font-bold px-4 py-1.5 rounded-full">{addLabel ?? 'Add'}</button>
        }
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {MACRO_KEYS.map(field => (
            <div key={field}>
              <label className="text-zinc-500 capitalize block mb-0.5">{field}</label>
              <input type="number" value={displayed[field] as number}
                onChange={e => update(field, e.target.value)}
                className="w-full bg-zinc-900 text-white rounded-lg px-2 py-1.5 focus:outline-none border border-zinc-700 focus:border-zinc-500" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
