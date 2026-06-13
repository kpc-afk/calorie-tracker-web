'use client'
import { useEffect, useState } from 'react'

const STAGE_SWITCH_MS = 2500

export default function ThinkingIndicator({ hasImages }: { hasImages: boolean }) {
  const [stage, setStage] = useState(hasImages ? 'Reading photo…' : 'Estimating macros…')

  useEffect(() => {
    if (!hasImages) return
    setStage('Reading photo…')
    const t = setTimeout(() => setStage('Estimating macros…'), STAGE_SWITCH_MS)
    return () => clearTimeout(t)
  }, [hasImages])

  return (
    <div className="space-y-2">
      <div className="flex justify-start">
        <div className="bg-zinc-800 text-gray-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm">{stage}</div>
      </div>
      <div className="max-w-[85%] bg-zinc-800 rounded-2xl p-4 border border-zinc-700 animate-pulse space-y-3">
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-zinc-700 rounded w-2/3" />
            <div className="h-3 bg-zinc-700 rounded w-1/3" />
          </div>
          <div className="h-5 bg-zinc-700 rounded w-12 shrink-0" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 bg-zinc-700 rounded w-12" />
          <div className="h-3 bg-zinc-700 rounded w-12" />
          <div className="h-3 bg-zinc-700 rounded w-12" />
        </div>
      </div>
    </div>
  )
}
