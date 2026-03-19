'use client'

import { useState, useRef, type KeyboardEvent } from 'react'

interface ChatInputProps {
  onSubmit: (text: string) => void
  disabled: boolean
  selectedElement?: { tag: string; text: string } | null
  onClearSelection?: () => void
}

export function ChatInput({ onSubmit, disabled, selectedElement, onClearSelection }: ChatInputProps) {
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
      {selectedElement && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-blue-600/30 bg-blue-600/10 px-3 py-1.5">
          <span className="text-xs text-blue-400">
            Editing: <span className="font-mono">&lt;{selectedElement.tag}&gt;</span>
            {selectedElement.text && (
              <span className="ml-1 text-blue-300">&ldquo;{selectedElement.text.slice(0, 30)}&rdquo;</span>
            )}
          </span>
          <button onClick={onClearSelection} className="ml-auto text-xs text-blue-400 hover:text-white">&times;</button>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selectedElement ? `Describe how to change this ${selectedElement.tag}...` : 'Describe what you want to build...'}
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
