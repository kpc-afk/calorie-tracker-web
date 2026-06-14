type Props = { value: string | number; label: string; size?: 'hero' | 'lg' | 'md'; tone?: 'ink' | 'accent' | 'danger'; suffix?: string }
const SIZES = { hero: 'text-[64px] leading-none', lg: 'text-[40px] leading-none', md: 'text-[26px] leading-none' }
const TONES = { ink: 'text-[var(--ink)]', accent: 'text-[var(--accent)]', danger: 'text-[var(--danger)]' }
export default function StatNumeral({ value, label, size = 'md', tone = 'ink', suffix }: Props) {
  return (
    <div>
      <div className={`font-display tnum ${SIZES[size]} ${TONES[tone]}`}>
        {value}{suffix && <span className="text-[0.45em] text-[var(--muted)] ml-1">{suffix}</span>}
      </div>
      <div className="micro-label mt-1.5">{label}</div>
    </div>
  )
}
