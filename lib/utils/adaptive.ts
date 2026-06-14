type Params = {
  tdeeEstimate: number; reliable: boolean
  currentBase: number; currentDeficit: number
  trendRatePerWeekKg: number; targetRatePerWeekKg: number // negative = losing
}
export type TargetSuggestion = { suggest: boolean; newBase?: number; newDeficit?: number; reason?: string }

export function suggestTargetAdjustment(p: Params): TargetSuggestion {
  if (!p.reliable) return { suggest: false }
  const gap = p.trendRatePerWeekKg - p.targetRatePerWeekKg // >0 = losing too slowly
  if (Math.abs(gap) <= 0.15) return { suggest: false }
  const kcalAdjust = Math.round((gap * 7700) / 7 / 10) * 10 // weekly gap → daily kcal, 10s
  const clamped = Math.max(-250, Math.min(250, kcalAdjust))
  let newBase = p.currentBase - clamped
  newBase = Math.max(1400, newBase)
  const newDeficit = Math.min(750, p.currentDeficit + (p.currentBase - newBase))
  if (newBase === p.currentBase) return { suggest: false }
  return {
    suggest: true, newBase, newDeficit,
    reason: gap > 0
      ? `Losing ${Math.abs(p.trendRatePerWeekKg).toFixed(2)} kg/wk vs ${Math.abs(p.targetRatePerWeekKg).toFixed(2)} target — tighten by ${p.currentBase - newBase} kcal.`
      : `Losing faster than target — ease up by ${newBase - p.currentBase} kcal.`,
  }
}
