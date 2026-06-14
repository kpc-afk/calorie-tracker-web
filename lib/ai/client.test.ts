import { describe, it, expect } from 'vitest'
import { generateWithRetry, classifyGeminiError } from './client'

const ok = async () => ({ text: '{"a":1}' })
const cap = (status: number) => async () => { const e = new Error(`got ${status}`) as Error & { status: number }; e.status = status; throw e }

describe('generateWithRetry', () => {
  it('returns ok on first success', async () => {
    const r = await generateWithRetry([ok], 'x', { retries: 1, baseDelayMs: 1 })
    expect(r).toEqual({ ok: true, text: '{"a":1}', modelIndex: 0 })
  })
  it('retries capacity errors then falls back to next model', async () => {
    let calls = 0
    const flaky = async () => { calls++; const e = new Error('503 overloaded') as Error & { status: number }; e.status = 503; throw e }
    const r = await generateWithRetry([flaky, ok], 'x', { retries: 1, baseDelayMs: 1 })
    expect(calls).toBe(2) // initial + 1 retry on model 0
    expect(r).toEqual({ ok: true, text: '{"a":1}', modelIndex: 1 })
  })
  it('returns typed failure when all models exhausted', async () => {
    const r = await generateWithRetry([cap(429)], 'x', { retries: 1, baseDelayMs: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('rate_limit')
  })
  it('does not retry non-capacity errors', async () => {
    let calls = 0
    const bad = async () => { calls++; throw new Error('invalid argument') }
    const r = await generateWithRetry([bad], 'x', { retries: 2, baseDelayMs: 1 })
    expect(calls).toBe(1)
    if (!r.ok) expect(r.error).toBe('unknown')
  })
})

describe('classifyGeminiError', () => {
  it('classifies 429/quota as rate_limit', () => {
    expect(classifyGeminiError(new Error('429 Too Many Requests'))).toBe('rate_limit')
    expect(classifyGeminiError(new Error('RESOURCE_EXHAUSTED: quota'))).toBe('rate_limit')
  })
  it('classifies 503/overloaded as overloaded', () => {
    expect(classifyGeminiError(new Error('The model is overloaded'))).toBe('overloaded')
  })
})
