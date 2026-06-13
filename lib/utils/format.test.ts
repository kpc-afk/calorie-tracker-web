import { describe, it, expect } from 'vitest'
import { offsetDate } from './format'

describe('offsetDate', () => {
  it('adds days to an ISO date string', () => {
    expect(offsetDate('2026-06-10', 1)).toBe('2026-06-11')
  })
})
