import { describe, it, expect } from 'vitest'
import { SwrCache } from './cache'

describe('SwrCache', () => {
  it('stores and returns values', () => {
    const c = new SwrCache()
    c.set('k', { a: 1 })
    expect(c.get('k')).toEqual({ a: 1 })
  })
  it('invalidate by prefix clears matching keys only', () => {
    const c = new SwrCache()
    c.set('/api/entries?date=2026-06-12', 1)
    c.set('/api/entries?date=2026-06-11', 2)
    c.set('/api/profile', 3)
    c.invalidatePrefix('/api/entries')
    expect(c.get('/api/entries?date=2026-06-12')).toBeUndefined()
    expect(c.get('/api/profile')).toBe(3)
  })
})
