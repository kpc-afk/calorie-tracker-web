'use client'
import { useState, useEffect, useRef } from 'react'
import { haptic } from '@/lib/utils/haptic'
import MicroLabel from '@/components/ui/MicroLabel'
import HairlineCard from '@/components/ui/HairlineCard'
import type { WeeklyReview } from '@/app/api/weekly-review/route'

type CoachMessage = { role: 'user' | 'assistant'; content: string }

const HISTORY_KEY = 'coach_history'

const STARTERS = [
  'Why am I not losing weight?',
  'What should I eat to hit protein today?',
  'How was my week?',
  'What days do I tend to overeat?',
]

const ERROR_COPY: Record<string, string> = {
  rate_limit: 'Gemini free-tier limit hit — wait ~30s.',
  overloaded: 'Gemini is busy right now.',
}
const DEFAULT_ERROR = 'Something went wrong — try again.'

export default function CoachPage() {
  const [messages, setMessages] = useState<CoachMessage[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [review, setReview] = useState<WeeklyReview | null>(null)
  const [reviewChecked, setReviewChecked] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    fetch('/api/weekly-review')
      .then(r => r.json())
      .then(d => { if (d.exists) setReview(d.review) })
      .catch(() => { /* ignore */ })
      .finally(() => setReviewChecked(true))
  }, [])

  async function generateReview() {
    haptic('light')
    setReviewLoading(true)
    setReviewError(null)
    try {
      const res = await fetch('/api/weekly-review', { method: 'POST' })
      const data = await res.json()
      if (data.review) setReview(data.review)
      else setReviewError(ERROR_COPY[data.error] ?? DEFAULT_ERROR)
    } catch {
      setReviewError(DEFAULT_ERROR)
    }
    setReviewLoading(false)
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    requestAnimationFrame(() => {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`
    })
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    haptic('light')
    const history = messages.slice(-10)
    setMessages(prev => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    function setReply(content: string) {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content }
        return copy
      })
    }

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      })

      const contentType = res.headers.get('Content-Type') ?? ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        setReply(ERROR_COPY[data.error] ?? DEFAULT_ERROR)
      } else if (res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let acc = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          acc += decoder.decode(value, { stream: true })
          setReply(acc)
        }
        haptic('light')
      } else {
        setReply(DEFAULT_ERROR)
      }
    } catch {
      setReply(DEFAULT_ERROR)
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function clearHistory() {
    haptic('light')
    setMessages([])
    localStorage.removeItem(HISTORY_KEY)
  }

  const canSend = input.trim().length > 0 && !loading

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-5 pt-6 pb-3 flex items-center justify-between">
        <div className="font-display italic text-[26px] leading-none">Coach</div>
        {messages.length > 0 && (
          <button onClick={clearHistory}
            className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--ink-60)] transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Weekly review */}
      {reviewChecked && (
        <div className="shrink-0 px-5 mb-3">
          <HairlineCard className="p-4 space-y-3">
            <MicroLabel>Weekly review</MicroLabel>
            {review ? (
              <>
                <div className="space-y-1.5">
                  <MicroLabel>Wins</MicroLabel>
                  {review.wins.map((w, i) => (
                    <div key={i} className="pl-3 border-l border-[var(--accent)] text-[var(--ink)] text-[14px] leading-relaxed">{w}</div>
                  ))}
                </div>
                {review.concerns.length > 0 && (
                  <div className="space-y-1.5">
                    <MicroLabel>Watch</MicroLabel>
                    {review.concerns.map((c, i) => (
                      <div key={i} className="pl-3 border-l border-[var(--hairline-strong)] text-[var(--ink-60)] text-[14px] leading-relaxed">{c}</div>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  <MicroLabel>Focus</MicroLabel>
                  <p className="text-[var(--ink)] text-[14px] leading-relaxed">{review.focus}</p>
                </div>
              </>
            ) : (
              <>
                <button onClick={generateReview} disabled={reviewLoading}
                  className="w-full border border-[var(--hairline)] hover:border-[var(--hairline-strong)] text-[var(--ink)] text-sm font-medium py-2.5 rounded-[var(--radius)] transition-colors disabled:opacity-50">
                  {reviewLoading ? 'Generating…' : 'Generate weekly review'}
                </button>
                {reviewError && <p className="text-[var(--danger)] text-[13px] text-center">{reviewError}</p>}
              </>
            )}
          </HairlineCard>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="pt-2 space-y-3">
            <MicroLabel>Ask anything</MicroLabel>
            <div className="grid grid-cols-2 gap-2">
              {STARTERS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-left border border-[var(--hairline)] hover:border-[var(--hairline-strong)] rounded-[var(--radius)] p-3 transition-colors">
                  <p className="text-[var(--ink-60)] text-[13px] leading-relaxed">{s}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isLast = i === messages.length - 1
          if (m.role === 'user') return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] text-[var(--ink-60)] text-[15px] leading-relaxed text-right">{m.content}</div>
            </div>
          )
          return (
            <div key={i} className="pl-3 border-l border-[var(--hairline)] text-[var(--ink)] text-[15px] leading-relaxed whitespace-pre-wrap min-h-[1.5em]">
              {m.content}
              {loading && isLast && (
                m.content === ''
                  ? (
                    <span className="inline-flex gap-1 align-middle">
                      {[0, 1, 2].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-pulse" style={{ animationDelay: `${d * 150}ms` }} />
                      ))}
                    </span>
                  )
                  : <span className="inline-block w-[2px] h-[1em] bg-[var(--accent)] ml-0.5 align-middle animate-pulse" />
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--hairline)] px-5 py-3 safe-area-pb">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Ask your coach…"
            rows={1}
            className="flex-1 bg-transparent text-[var(--ink)] placeholder-[var(--muted)] border border-[var(--hairline)] rounded-[var(--radius)] px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--hairline-strong)]"
            style={{ minHeight: '42px', maxHeight: '128px' }}
          />
          <button onClick={() => sendMessage(input)} disabled={!canSend}
            className="bg-[var(--accent)] text-[var(--accent-ink)] font-semibold rounded-[var(--radius)] w-9 h-9 flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity text-lg leading-none">
            ↑
          </button>
        </div>
        <p className="text-center text-[var(--muted)] text-xs mt-1.5">Coach has full access to your last 28 days</p>
      </div>
    </div>
  )
}
