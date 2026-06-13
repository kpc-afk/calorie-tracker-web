import { NextRequest, NextResponse } from 'next/server'
import { dispatchChat } from '@/lib/ai/chat-dispatcher'
import { getProfile } from '@/lib/db/queries'

export const runtime = 'edge'
export const maxDuration = 25

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const message = (formData.get('message') as string) ?? ''
    const todayContext = JSON.parse(formData.get('todayContext') as string)
    const history = JSON.parse(formData.get('history') as string)
    const today = formData.get('today') as string
    const sessionItemsRaw = formData.get('sessionItems') as string | null
    const sessionItems = sessionItemsRaw ? JSON.parse(sessionItemsRaw) : []

    const imageFiles = formData.getAll('images') as File[]
    const imageBase64Array: string[] = []
    const imageMimeTypes: string[] = []

    for (const file of imageFiles) {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
      }
      imageBase64Array.push(btoa(binary))
      imageMimeTypes.push(file.type || 'image/jpeg')
    }

    const profile = await getProfile()
    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 400 })
    }

    const response = await dispatchChat({
      message,
      imageBase64Array,
      imageMimeTypes,
      profile,
      todayContext,
      history,
      today,
      sessionItems,
    })

    if ('aiError' in response) {
      const status = response.aiError === 'rate_limit' ? 429 : response.aiError === 'overloaded' ? 503 : 502
      return NextResponse.json({ error: response.aiError }, { status })
    }

    return NextResponse.json(response)
  } catch (err: unknown) {
    const fullMsg = err instanceof Error ? err.message : String(err)
    console.error('Chat error:', fullMsg)
    const msg = fullMsg.toLowerCase()
    const httpStatus = (err as { status?: number; statusCode?: number })?.status ?? (err as { status?: number; statusCode?: number })?.statusCode
    if (httpStatus === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('too many requests') || msg.includes('resource_exhausted') || msg.includes('resource exhausted')) {
      return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
    }
    if (httpStatus === 503 || msg.includes('503') || msg.includes('service unavailable') || msg.includes('high demand') || msg.includes('overloaded')) {
      return NextResponse.json({ error: 'overloaded' }, { status: 503 })
    }
    return NextResponse.json({ error: fullMsg.slice(0, 300) }, { status: 500 })
  }
}
