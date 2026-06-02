'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

type Attachment = { file: File; preview: string }

type Props = {
  onSend: (message: string, images: File[]) => void
  disabled?: boolean
  onBarcodeClick?: () => void
}

export default function ChatInput({ onSend, disabled, onBarcodeClick }: Props) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return () => { attachments.forEach(a => URL.revokeObjectURL(a.preview)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = useCallback((files: FileList | File[]) => {
    const newAttachments = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setAttachments(prev => [...prev, ...newAttachments])
  }, [])

  function removeImage(i: number) {
    setAttachments(prev => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pastedFiles: File[] = []
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) pastedFiles.push(file)
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault()
      addFiles(pastedFiles)
    }
  }

  function handleSend() {
    if (!text.trim() && attachments.length === 0) return
    onSend(text.trim(), attachments.map(a => a.file))
    setText('')
    attachments.forEach(a => URL.revokeObjectURL(a.preview))
    setAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    requestAnimationFrame(() => {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`
    })
  }

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 p-3 safe-area-pb shrink-0">
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {attachments.map((a, i) => (
            <div key={a.preview} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.preview} alt="" className="h-16 w-16 object-cover rounded-lg border border-zinc-700" />
              <button onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button onClick={() => fileRef.current?.click()} disabled={disabled}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 shrink-0 mb-1 text-xl leading-none disabled:opacity-40">
          📎
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />
        {onBarcodeClick && (
          <button onClick={onBarcodeClick} disabled={disabled}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 shrink-0 mb-1 disabled:opacity-40"
            title="Scan barcode">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5v2M3 19v-2M5 3h2M19 3h-2M21 5v2M21 19v-2M19 21h-2M5 21h2"/>
              <rect x="7" y="7" width="3" height="10" rx="0.5"/>
              <rect x="11" y="7" width="1.5" height="10" rx="0.5"/>
              <rect x="14" y="7" width="3" height="10" rx="0.5"/>
            </svg>
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onInput={handleInput}
          placeholder="Log food, workout, steps, or ask anything…"
          rows={1}
          disabled={disabled}
          className="flex-1 bg-zinc-800 text-white placeholder-zinc-500 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
          style={{ minHeight: '42px', maxHeight: '128px' }}
        />
        <button onClick={handleSend} disabled={!canSend}
          className="bg-green-500 text-black font-bold rounded-full w-9 h-9 flex items-center justify-center shrink-0 disabled:opacity-30 mb-0.5 transition-opacity text-lg leading-none">
          ↑
        </button>
      </div>
      <p className="text-center text-zinc-700 text-xs mt-1.5">⌘↵ send · paste or attach images</p>
    </div>
  )
}
