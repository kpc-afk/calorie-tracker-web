export default function HairlineCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-[var(--hairline)] rounded-[var(--radius)] bg-transparent ${className}`}>{children}</div>
}
