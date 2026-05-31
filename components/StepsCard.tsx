type Props = { steps: number; stepsCalories: number; message: string; onAdd: () => void; added: boolean }

export default function StepsCard({ steps, stepsCalories, message, onAdd, added }: Props) {
  return (
    <div className={`bg-zinc-800 rounded-2xl p-4 border ${added ? 'border-green-700 opacity-60' : 'border-zinc-700'}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">👟</span>
        <div>
          <div className="text-white font-semibold text-sm">{steps.toLocaleString()} steps</div>
          <div className="text-gray-400 text-xs">+{Math.round(stepsCalories)} kcal to your budget</div>
        </div>
      </div>
      <p className="text-gray-500 text-xs mb-3 italic leading-relaxed">{message}</p>
      <div className="flex justify-end">
        {added
          ? <span className="text-green-500 text-xs font-medium">✓ Logged</span>
          : <button onClick={onAdd} className="bg-green-500 text-black text-xs font-semibold px-4 py-1.5 rounded-full">Log steps</button>
        }
      </div>
    </div>
  )
}
