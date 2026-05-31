'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/dashboard', label: 'Log', icon: '🥗' },
  { href: '/progress', label: 'Progress', icon: '📊' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      <main className="flex-1 overflow-y-auto">{children}</main>
      <nav className="shrink-0 bg-zinc-900 border-t border-zinc-800 flex safe-area-pb">
        {tabs.map(tab => {
          const active = pathname === tab.href
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${active ? 'text-green-400' : 'text-zinc-500'}`}>
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
