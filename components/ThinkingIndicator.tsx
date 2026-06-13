'use client'
import { useEffect, useState } from 'react'
import HairlineCard from './ui/HairlineCard'

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
      <div className="pl-3 border-l border-[var(--hairline)] text-[13px] text-[var(--ink-60)]">{stage}</div>
      <HairlineCard className="p-4 animate-pulse space-y-3">
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-2 flex-1">
            <div className="h-4 rounded-[var(--radius)] w-2/3 bg-[var(--hairline)]" />
            <div className="h-3 rounded-[var(--radius)] w-1/3 bg-[var(--hairline)]" />
          </div>
          <div className="h-5 rounded-[var(--radius)] w-12 shrink-0 bg-[var(--hairline)]" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 rounded-[var(--radius)] w-12 bg-[var(--hairline)]" />
          <div className="h-3 rounded-[var(--radius)] w-12 bg-[var(--hairline)]" />
          <div className="h-3 rounded-[var(--radius)] w-12 bg-[var(--hairline)]" />
        </div>
      </HairlineCard>
    </div>
  )
}
