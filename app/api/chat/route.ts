import { NextRequest, NextResponse } from 'next/server'
import { dispatchChat } from '@/lib/ai/chat-dispatcher'
import { getProfile } from '@/lib/db/queries'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const message = (formData.get('message') as string) ?? ''
    const todayContext = JSON.parse(formData.get('todayContext') as string)
    const history = JSON.parse(formData.get('history') as string)
    const today = formData.get('today') as string

    const imageFiles = formData.getAll('images') as File[]
    const imageBase64Array: string[] = []
    const imageMimeTypes: string[] = []

    for (const file of imageFiles) {
      const buffer = await file.arrayBuffer()
      imageBase64Array.push(Buffer.from(buffer).toString('base64'))
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
    })

    return NextResponse.json(response)
  } catch (err: unknown) {
    const fullMsg = err instanceof Error ? err.message : String(err)
    console.error('Chat error:', fullMsg)
    const msg = fullMsg.toLowerCase()
    const httpStatus = (err as { status?: number; statusCode?: number })?.status ?? (err as { status?: number; statusCode?: number })?.statusCode
    if (httpStatus === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('too many requests') || msg.includes('resource_exhausted') || msg.includes('resource exhausted')) {
      return NextResponse.json({ error: 'rate_limit', detail: fullMsg.slice(0, 300) }, { status: 429 })
    }
    return NextResponse.json({ error: fullMsg.slice(0, 300) }, { status: 500 })
  }
}
