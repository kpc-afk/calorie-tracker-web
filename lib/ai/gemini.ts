import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// thinkingConfig not in SDK types yet but passes through to the API.
// Budget of 1024 ≈ 7s thinking — keeps total response well under the 25s Edge limit on Vercel Hobby.
type GenerationConfigWithThinking = Parameters<typeof genAI.getGenerativeModel>[0]['generationConfig'] & {
  thinkingConfig?: { thinkingBudget: number }
}

export const flashModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { temperature: 0.2, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 1024 } } as GenerationConfigWithThinking,
})

export const flashModelText = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { temperature: 0.5, thinkingConfig: { thinkingBudget: 1024 } } as GenerationConfigWithThinking,
})

// gemini-3.5-flash-lite does not exist (verified via the models list endpoint) —
// gemini-3.1-flash-lite is the closest stable flash-lite-class fallback.
export const PRIMARY_MODEL = 'gemini-3.5-flash'
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite'

export function makeModel(modelId: string, opts: { json?: boolean; schema?: object; temperature?: number; systemInstruction?: string }) {
  return genAI.getGenerativeModel({
    model: modelId,
    ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      ...(opts.schema ? { responseSchema: opts.schema } : {}),
      thinkingConfig: { thinkingBudget: 1024 },
    } as GenerationConfigWithThinking,
  })
}

export function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${cleaned.slice(0, 100)}`)
  }
}
