import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// thinkingConfig is not in SDK types yet but passes through to the API — disables thinking tokens to prevent timeouts
type GenerationConfigWithThinking = Parameters<typeof genAI.getGenerativeModel>[0]['generationConfig'] & {
  thinkingConfig?: { thinkingBudget: number }
}

export const flashModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { temperature: 0.2, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } as GenerationConfigWithThinking,
})

export const flashModelText = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { temperature: 0.5, thinkingConfig: { thinkingBudget: 0 } } as GenerationConfigWithThinking,
})

export function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${cleaned.slice(0, 100)}`)
  }
}
