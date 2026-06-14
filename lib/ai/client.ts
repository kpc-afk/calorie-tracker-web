export type AIErrorKind = 'rate_limit' | 'overloaded' | 'parse' | 'unknown'
export type AIResult =
  | { ok: true; text: string; modelIndex: number }
  | { ok: false; error: AIErrorKind; detail: string }

export function classifyGeminiError(err: unknown): AIErrorKind {
  const status = (err as { status?: number })?.status
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('resource exhausted') || msg.includes('too many requests')) return 'rate_limit'
  if (status === 503 || msg.includes('503') || msg.includes('overloaded') || msg.includes('service unavailable') || msg.includes('high demand')) return 'overloaded'
  return 'unknown'
}

type Caller = () => Promise<{ text: string }>
type Opts = { retries?: number; baseDelayMs?: number }

/**
 * Tries each caller (one per model, primary first). Capacity errors retry with
 * jittered backoff `retries` times per model, then fall through to the next model.
 * Non-capacity errors fail immediately. Total budget must stay well under the
 * 25s Edge limit: defaults are 1 retry, ~1s base delay → worst case ≈ 2 calls
 * per model + ~2s sleeping.
 */
export async function generateWithRetry(callers: Caller[], _label: string, opts: Opts = {}): Promise<AIResult> {
  const retries = opts.retries ?? 1
  const baseDelayMs = opts.baseDelayMs ?? 1000
  let lastKind: AIErrorKind = 'unknown'
  let lastDetail = ''
  for (let m = 0; m < callers.length; m++) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { text } = await callers[m]()
        return { ok: true, text, modelIndex: m }
      } catch (err) {
        lastKind = classifyGeminiError(err)
        lastDetail = err instanceof Error ? err.message : String(err)
        if (lastKind === 'unknown' || lastKind === 'parse') return { ok: false, error: lastKind, detail: lastDetail }
        if (attempt < retries) await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1) + Math.random() * 250))
      }
    }
  }
  return { ok: false, error: lastKind, detail: lastDetail }
}
