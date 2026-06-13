export default function MicroLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`micro-label ${className}`}>{children}</div>
}
