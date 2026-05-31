export function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

export function offsetDate(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function formatDisplayDate(isoDate: string): string {
  const today = todayString()
  const yesterday = offsetDate(today, -1)
  if (isoDate === today) return 'Today'
  if (isoDate === yesterday) return 'Yesterday'
  return new Date(isoDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short'
  })
}

export function cmToFtIn(cm: number): string {
  const totalIn = cm / 2.54
  const ft = Math.floor(totalIn / 12)
  const inches = Math.round(totalIn % 12)
  return `${ft}'${inches}"`
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.2046 * 10) / 10
}
