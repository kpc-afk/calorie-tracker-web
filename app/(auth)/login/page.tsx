'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">📬</div>
        <h1 className="text-white text-xl font-semibold mb-2">Check your email</h1>
        <p className="text-gray-400">Magic link sent to <span className="text-white">{email}</span></p>
        <p className="text-gray-500 text-sm mt-2">Tap the link to sign in.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥗</div>
          <h1 className="text-white text-2xl font-bold">Calorie Tracker</h1>
          <p className="text-gray-400 mt-1">Sign in with your email</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com" required
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
          <button type="submit" disabled={loading}
            className="w-full bg-green-500 text-black font-semibold py-3 rounded-xl disabled:opacity-50">
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      </div>
    </div>
  )
}
