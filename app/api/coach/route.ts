import { NextRequest } from 'next/server'
import { makeModel, PRIMARY_MODEL, FALLBACK_MODEL } from '@/lib/ai/gemini'
import { classifyGeminiError } from '@/lib/ai/client'
import { buildCoachDigest } from '@/lib/ai/digest'

export const runtime = 'edge'

const PERSONA = 'Direct, honest, data-driven nutrition advisor. No sugar-coating, no cheerleading. Straight facts and numbers. Metric units only (kg, km, ml). Weekly average beats daily perfection; minor overages are not emergencies. No guilt workouts — if mentally exhausted, recommend sleep. Muscle over scale weight: protein floor comes before the calorie ceiling.'

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } })
}

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json()
    if (!message?.trim()) return jsonError('No message', 400)

    const digest = await buildCoachDigest()

    const systemInstruction = `You are a personal nutrition coach with full access to the user's data.

PERSONA: ${PERSONA}

${digest}

Answer concisely (2-4 sentences unless a detailed breakdown is asked for), cite their numbers, never log or modify data.`

    const chatHistory = (history ?? []).slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }))

    const modelIds = [PRIMARY_MODEL, FALLBACK_MODEL]
    let lastErr: unknown = null

    for (const modelId of modelIds) {
      try {
        const model = makeModel(modelId, { temperature: 0.5, systemInstruction })
        const chat = model.startChat({ history: chatHistory })
        const result = await chat.sendMessageStream(message)

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of result.stream) {
                const text = chunk.text()
                if (text) controller.enqueue(encoder.encode(text))
              }
            } catch {
              controller.enqueue(encoder.encode('\n\n[connection lost — tap retry]'))
            }
            controller.close()
          },
        })
        return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      } catch (err) {
        lastErr = err
        const kind = classifyGeminiError(err)
        if (kind === 'unknown' || kind === 'parse') break
      }
    }

    const kind = classifyGeminiError(lastErr)
    const status = kind === 'rate_limit' ? 429 : kind === 'overloaded' ? 503 : 500
    return jsonError(kind, status)
  } catch (err) {
    console.error('Coach error:', err)
    return jsonError('Coach failed', 500)
  }
}
