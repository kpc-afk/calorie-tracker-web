export function haptic(type: 'light' | 'medium' | 'goal' = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  if (type === 'light') navigator.vibrate(10)
  else if (type === 'medium') navigator.vibrate(20)
  else if (type === 'goal') navigator.vibrate([10, 60, 10])
}
