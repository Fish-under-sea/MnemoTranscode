/**
 * AI 对话气泡组件
 */
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  memberName?: string
  avatar?: string
}

export default function ChatBubble({ role, content, memberName, avatar }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* 头像 */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium',
          isUser ? 'bg-primary-100 text-primary-700' : 'bg-accent-green/20 text-accent-green'
        )}
      >
        {isUser ? <User size={16} /> : (avatar || memberName?.charAt(0) || 'AI')}
      </div>

      {/* 消息内容 */}
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary-600 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        )}
      >
        {!isUser && memberName && (
          <div className="text-xs font-medium mb-1 opacity-70">{memberName}</div>
        )}
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  )
}
