'use client'
import { useState, useRef } from 'react'
import type { NutritionResult } from '@/lib/db/types'
import { haptic } from '@/lib/utils/haptic'
import HairlineCard from './ui/HairlineCard'
import MicroLabel from './ui/MicroLabel'

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

  return (
    <HairlineCard className={`p-4 transition-opacity ${added ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <input value={item.name} onChange={e => update('name', e.target.value)}
            className="bg-transparent text-[var(--ink)] font-medium text-[15px] w-full focus:outline-none border-b border-transparent focus:border-[var(--hairline-strong)] pb-0.5" />
          <div className="text-[var(--ink-60)] text-xs mt-1 tnum">{item.serving_size} {item.serving_unit} per serving</div>
        </div>
        <div className="font-display tnum text-[var(--ink)] text-2xl shrink-0 leading-none">
          {Math.round(displayed.calories)}
          <span className="text-[0.4em] text-[var(--muted)] ml-1">kcal</span>
        </div>
      </div>

      {/* Macro row */}
      <div className="flex gap-5 mb-3">
        <div>
          <div className="font-display tnum text-[var(--ink)] text-base leading-none">{Math.round(displayed.protein)}<span className="text-[var(--muted)] text-xs ml-0.5">g</span></div>
          <MicroLabel className="mt-1">Protein</MicroLabel>
        </div>
        <div>
          <div className="font-display tnum text-[var(--ink)] text-base leading-none">{Math.round(displayed.carbs)}<span className="text-[var(--muted)] text-xs ml-0.5">g</span></div>
          <MicroLabel className="mt-1">Carbs</MicroLabel>
        </div>
        <div>
          <div className="font-display tnum text-[var(--ink)] text-base leading-none">{Math.round(displayed.fat)}<span className="text-[var(--muted)] text-xs ml-0.5">g</span></div>
          <MicroLabel className="mt-1">Fat</MicroLabel>
        </div>
      </div>

      {/* Serving multiplier */}
      <div className="flex items-center gap-2 mb-3 pt-3 border-t border-[var(--hairline)]">
        <MicroLabel>Servings</MicroLabel>
        <button onClick={() => applyServings(Math.max(0.25, servings - 0.5))}
          className="w-6 h-6 rounded-[var(--radius)] border border-[var(--hairline)] text-[var(--ink)] text-sm flex items-center justify-center hover:border-[var(--hairline-strong)] transition-colors">
          −
        </button>
        <input
          type="number"
          value={servingsInput}
          onChange={e => handleServingsInput(e.target.value)}
          onBlur={() => setServingsInput(String(servings))}
          className="w-14 bg-transparent text-[var(--ink)] tnum text-xs text-center rounded-[var(--radius)] px-2 py-1 border border-[var(--hairline)] focus:outline-none focus:border-[var(--hairline-strong)]"
          step="0.5"
          min="0.25"
          max="20"
        />
        <button onClick={() => applyServings(servings + 0.5)}
          className="w-6 h-6 rounded-[var(--radius)] border border-[var(--hairline)] text-[var(--ink)] text-sm flex items-center justify-center hover:border-[var(--hairline-strong)] transition-colors">
          +
        </button>
        <button
          onClick={() => { setShowAskAI(v => !v); setAiExplanation('') }}
          className="ml-auto text-xs text-[var(--ink-60)] hover:text-[var(--ink)] transition-colors font-medium">
          Ask AI ✦
        </button>
      </div>

      {/* AI explanation after a successful query */}
      {aiExplanation && !showAskAI && (
        <p className="text-[var(--ink-60)] text-xs mb-2 italic">✦ {aiExplanation}</p>
      )}

      {/* Ask AI inline form */}
      {showAskAI && (
        <div className="mb-3 space-y-2">
          <input
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAskAI()}
            placeholder={`e.g. "I ate 5 nuggets" or "about 200g"`}
            className="w-full bg-transparent text-[var(--ink)] text-xs rounded-[var(--radius)] px-3 py-2 border border-[var(--hairline)] focus:outline-none focus:border-[var(--accent)] placeholder-[var(--muted)]"
            autoFocus
          />
          {aiExplanation && (
            <p className="text-[var(--ink-60)] text-xs italic">{aiExplanation}</p>
          )}
          <div className="flex gap-2">
            <button onClick={handleAskAI} disabled={!aiQuestion.trim() || aiLoading}
              className="flex-1 bg-[var(--accent)] text-[var(--accent-ink)] text-xs font-semibold py-2 rounded-[var(--radius)] disabled:opacity-40">
              {aiLoading ? 'Calculating…' : 'Calculate servings'}
            </button>
            <button onClick={() => { setShowAskAI(false); setAiExplanation('') }}
              className="px-3 py-2 rounded-[var(--radius)] border border-[var(--hairline)] text-[var(--ink-60)] text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      {item.commentary && (
        <p className="text-[var(--ink-60)] text-xs mb-3 italic leading-relaxed">{item.commentary}</p>
      )}

      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-[var(--ink-60)] hover:text-[var(--ink)] transition-colors">
          {expanded ? 'Less ▲' : 'Details ▼'}
        </button>
        <div className="flex-1" />
        {added
          ? <span className="text-[11px] tnum text-[var(--accent)]">✓ Added</span>
          : <button onClick={() => { haptic('medium'); onAdd() }} className="bg-[var(--accent)] text-[var(--accent-ink)] text-xs font-semibold px-4 py-1.5 rounded-[var(--radius)]">{addLabel ?? 'Add'}</button>
        }
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--hairline)] grid grid-cols-2 gap-3">
          {MACRO_KEYS.map(field => (
            <div key={field}>
              <MicroLabel className="mb-1">{field}</MicroLabel>
              <input type="number" value={displayed[field] as number}
                onChange={e => update(field, e.target.value)}
                className="w-full bg-transparent text-[var(--ink)] tnum text-xs rounded-[var(--radius)] px-2 py-1.5 focus:outline-none border border-[var(--hairline)] focus:border-[var(--hairline-strong)]" />
            </div>
          ))}
        </div>
      )}
    </HairlineCard>
  )
}
