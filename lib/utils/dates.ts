const LONDON_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }) // en-CA → YYYY-MM-DD

export function todayLondon(): string {
  return LONDON_FMT.format(new Date())
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`) // noon UTC avoids DST edges
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

export function daysAgoLondon(days: number): string {
  return addDays(todayLondon(), -days)
}

export function isoWeekKey(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // Thursday of this week determines the ISO year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Monday of the week containing isoDate */
export function weekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  const day = d.getUTCDay() || 7
  return addDays(isoDate, -(day - 1))
}
