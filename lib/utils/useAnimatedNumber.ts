'use client'
import { useEffect, useRef, useState } from 'react'

export function useAnimatedNumber(target: number, duration = 400): number {
  const [display, setDisplay] = useState(target)
  const prev = useRef(target)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const from = prev.current
    const to = target
    if (from === to) return

    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) {
        frame.current = requestAnimationFrame(tick)
      } else {
        prev.current = to
      }
    }
    frame.current = requestAnimationFrame(tick)
    return () => { if (frame.current) cancelAnimationFrame(frame.current) }
  }, [target, duration])

  return display
}
