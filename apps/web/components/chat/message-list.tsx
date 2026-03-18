'use client'

import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/lib/stores/chat-store'
import { MessageBubble } from './message-bubble'

interface MessageListProps {
  messages: ChatMessage[]
  onFileClick?: (path: string) => void
}

export function MessageList({ messages, onFileClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-neutral-500">
        <p className="text-lg font-medium">What do you want to build?</p>
        <p className="text-sm">Describe your app and Buildn will create it for you.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onFileClick={onFileClick} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
