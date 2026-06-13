import type { Metadata, Viewport } from 'next'
import { Instrument_Serif } from 'next/font/google'
import './globals.css'

const instrument = Instrument_Serif({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Calorie Tracker',
  description: 'AI-powered personal calorie tracker',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Calories',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0A0A09',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={instrument.variable}>{children}</body>
    </html>
  )
}
