export function todayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function offsetDate(isoDate: string, days: number): string {
  const [y, mo, d] = isoDate.split('-').map(Number)
  const date = new Date(y, mo - 1, d)
  date.setDate(date.getDate() + days)
  const yr = date.getFullYear()
  const mn = String(date.getMonth() + 1).padStart(2, '0')
  const dy = String(date.getDate()).padStart(2, '0')
  return `${yr}-${mn}-${dy}`
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
