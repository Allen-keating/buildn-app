'use client'

import { useState, useRef, type KeyboardEvent } from 'react'

interface ChatInputProps {
  onSubmit: (text: string) => void
  disabled: boolean
}

export function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setText('')
    ref.current?.focus()
  }

  return (
    <div className="border-t border-neutral-800 p-3">
      <div className="flex gap-2">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Describe what you want to build..."
          rows={2}
          className="flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
