import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const flashModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
})

export const flashModelText = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { temperature: 0.5 },
})

export function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  return JSON.parse(cleaned)
}
