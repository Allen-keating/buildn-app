import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { ChatMessage } from '@buildn/shared'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (prompt: string) => void
  isGenerating: boolean
  onFileClick?: (path: string) => void
}

export function ChatPanel({ messages, onSendMessage, isGenerating, onFileClick }: ChatPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} onFileClick={onFileClick} />
      <ChatInput onSubmit={onSendMessage} disabled={isGenerating} />
    </div>
  )
}
