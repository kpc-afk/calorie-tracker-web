'use client'
import { useState, useEffect, useRef } from 'react'
import { haptic } from '@/lib/utils/haptic'

type CoachMessage = { role: 'user' | 'assistant'; content: string }

const HISTORY_KEY = 'coach_history'

const STARTERS = [
  "Why am I not losing weight?",
  "What should I eat to hit protein today?",
  "How was my week?",
  "What days do I tend to overeat?",
]

export default function CoachPage() {
  const [messages, setMessages] = useState<CoachMessage[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages))
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    haptic('light')
    const userMsg: CoachMessage = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-10),
        }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
        haptic('light')
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong — try again.' }])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="shrink-0 px-4 pt-5 pb-4 bg-zinc-950 border-b border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">AI Coach</h1>
            <p className="text-zinc-500 text-xs mt-0.5">Ask anything about your nutrition</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); localStorage.removeItem(HISTORY_KEY) }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              Clear
            </button>
          )}
        </div>

      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="pt-4">
            <div className="text-zinc-600 text-xs text-center mb-4">Ask me anything about your nutrition</div>
            <div className="grid grid-cols-2 gap-2">
              {STARTERS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="bg-zinc-900 rounded-xl p-3 text-left border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <p className="text-zinc-400 text-xs leading-relaxed">{s}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <span className="text-blue-400 text-xs">✦</span>
              </div>
            )}
            <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-zinc-800 text-white rounded-br-sm'
                : 'bg-zinc-900 text-zinc-200 rounded-bl-sm border border-zinc-800'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mr-2 mt-0.5">
              <span className="text-blue-400 text-xs">✦</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4 pt-2 bg-zinc-950 border-t border-zinc-800/60">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach…"
            rows={1}
            className="flex-1 bg-zinc-900 text-white rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none border border-zinc-800 focus:border-blue-500/60 placeholder-zinc-600 transition-colors"
            style={{ maxHeight: 120, overflowY: input.split('\n').length > 4 ? 'auto' : 'hidden' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-zinc-700 text-xs text-center mt-2">Coach has full access to your 14-day history</p>
      </div>
    </div>
  )
}
