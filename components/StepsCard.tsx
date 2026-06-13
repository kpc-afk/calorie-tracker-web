import HairlineCard from './ui/HairlineCard'
import MicroLabel from './ui/MicroLabel'

type Props = { steps: number; stepsCalories: number; message: string; onAdd: () => void; added: boolean }

export default function StepsCard({ steps, stepsCalories, message, onAdd, added }: Props) {
  return (
    <HairlineCard className={`p-4 ${added ? 'opacity-50' : ''}`}>
      <div className="mb-2">
        <div className="font-display tnum text-[var(--ink)] text-2xl leading-none">
          {steps.toLocaleString()}<span className="text-[0.4em] text-[var(--muted)] ml-1.5">steps</span>
        </div>
        <MicroLabel className="mt-1.5">+{Math.round(stepsCalories)} kcal to your budget</MicroLabel>
      </div>
      <p className="text-[var(--ink-60)] text-[13px] leading-relaxed mb-3">{message}</p>
      <div className="flex justify-end">
        {added
          ? <span className="text-[11px] tnum text-[var(--accent)]">✓ Logged</span>
          : <button onClick={onAdd} className="bg-[var(--accent)] text-[var(--accent-ink)] text-[13px] font-semibold px-4 py-1.5 rounded-[var(--radius)]">Log steps</button>
        }
      </div>
    </HairlineCard>
  )
}
