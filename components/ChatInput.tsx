'use client'
import { useState, useRef, useCallback } from 'react'

type Props = {
  onSend: (message: string, images: File[]) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [images, setImages] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    setImages(prev => [...prev, ...imageFiles])
  }, [])

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
    if (!text.trim() && images.length === 0) return
    onSend(text.trim(), images)
    setText('')
    setImages([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  function removeImage(i: number) {
    setImages(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }

  const canSend = (text.trim().length > 0 || images.length > 0) && !disabled

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 p-3 safe-area-pb shrink-0">
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <div key={i} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(img)} alt="" className="h-16 w-16 object-cover rounded-lg border border-zinc-700" />
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
          onChange={e => e.target.files && addFiles(e.target.files)} />
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
