'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/lib/stores/chat-store'

interface MessageBubbleProps {
  message: ChatMessage
  onFileClick?: (path: string) => void
}

export function MessageBubble({ message, onFileClick }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
          isUser ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-100'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-neutral-900 [&_pre]:border [&_pre]:border-neutral-700 [&_code]:text-blue-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || ' '}
              </ReactMarkdown>
            </div>
            {message.status === 'streaming' && (
              <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-blue-400" />
            )}
          </>
        )}
        {message.fileOperations && message.fileOperations.length > 0 && (
          <div className="mt-2 border-t border-neutral-700 pt-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">Files changed</p>
            {message.fileOperations.map((op) => (
              <button
                key={op.path}
                onClick={() => onFileClick?.(op.path)}
                className="block text-xs text-blue-400 hover:underline"
              >
                {op.type === 'create' ? '+ ' : op.type === 'delete' ? '- ' : '~ '}
                {op.path}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
