'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const EMAIL = 'kchua.mba2027@london.edu'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password })
    if (error) {
      setError('Wrong password.')
    } else {
      router.replace('/chat')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <h1 className="font-display italic text-[40px] leading-none">Calorie Tracker</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            required
            className="w-full bg-transparent border border-[var(--hairline)] rounded-[var(--radius)] px-4 py-3 text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--hairline-strong)] text-center text-lg tracking-widest tnum"
          />
          {error && <p className="text-[var(--danger)] text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-[var(--accent)] text-[var(--accent-ink)] font-semibold py-3 rounded-[var(--radius)] disabled:opacity-40">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
