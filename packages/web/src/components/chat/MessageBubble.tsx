import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@buildn/shared'

interface MessageBubbleProps {
  message: ChatMessage
  onFileClick?: (path: string) => void
}

export function MessageBubble({ message, onFileClick }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
          isUser ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-100'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.fileOperations && message.fileOperations.length > 0 && (
          <div className="mt-2 border-t border-neutral-700 pt-2">
            <p className="text-xs text-neutral-400">Files changed:</p>
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
        {message.status === 'streaming' && (
          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-blue-400" />
        )}
      </div>
    </div>
  )
}
