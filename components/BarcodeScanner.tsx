'use client'
import { useEffect, useRef, useState } from 'react'

type Props = {
  onResult: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(true)
  const scannedRef = useRef(false)

  useEffect(() => {
    let stopped = false
    let controls: { stop: () => void } | null = null

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const codeReader = new BrowserMultiFormatReader()
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment')
        ) ?? devices[devices.length - 1]

        const deviceId = backCamera?.deviceId
        if (!videoRef.current || stopped) return

        controls = await codeReader.decodeFromVideoDevice(deviceId ?? undefined, videoRef.current, (result, err) => {
          if (stopped || scannedRef.current) return
          if (result) {
            scannedRef.current = true
            setScanning(false)
            onResult(result.getText())
          }
          if (err && !(err instanceof Error && err.message.includes('No MultiFormat Readers'))) {
            // ignore not-found errors during scanning
          }
        })
      } catch {
        if (!stopped) setError('Camera access denied or not available')
      }
    }

    start()

    return () => {
      stopped = true
      controls?.stop()
    }
  }, [onResult])

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col">
      <div className="flex items-center justify-between p-4 shrink-0">
        <span className="micro-label">Scan barcode</span>
        <button onClick={onClose} className="text-[var(--ink-60)] hover:text-[var(--ink)] text-2xl leading-none transition-colors">×</button>
      </div>

      <div className="flex-1 relative">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-40 border-2 border-[var(--accent)] rounded-[var(--radius)] opacity-80" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-8">
              <div className="text-[var(--danger)] font-medium mb-3 text-sm">{error}</div>
              <button onClick={onClose} className="border border-[var(--hairline)] text-[var(--ink)] px-4 py-2 rounded-[var(--radius)] text-sm">Close</button>
            </div>
          </div>
        )}
        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)]/60">
            <div className="font-display text-[var(--accent)] text-lg">✓ Barcode detected</div>
          </div>
        )}
      </div>

      <div className="p-4 shrink-0 text-center">
        <p className="text-[var(--ink-60)] text-xs">Point camera at a product barcode</p>
      </div>
    </div>
  )
}
