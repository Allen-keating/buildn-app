import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@buildn/shared'
import { MessageBubble } from './MessageBubble'

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
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        <p>Describe what you want to build</p>
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
