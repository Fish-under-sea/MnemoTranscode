// frontend/src/components/dialogue/ChatBubble.tsx
import { cn } from '@/lib/utils'
import TypingIndicator from './TypingIndicator'
import Avatar from '@/components/ui/Avatar'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  memberName?: string
  /** 助手侧头像（成员自定义头像 URL） */
  assistantAvatarSrc?: string
  /** 用户侧：当前登录用户头像 */
  userAvatarSrc?: string
  /** 用户侧：用于头像落款 / 无图时的首字母 */
  userName?: string
  /** 当前正在打字机渲染的内容（仅最后一条 assistant 消息传入） */
  typingContent?: string
  /** 是否显示打字机 loading 状态（content 为空时） */
  isTyping?: boolean
}

export default function ChatBubble({
  role,
  content,
  memberName,
  assistantAvatarSrc,
  userAvatarSrc,
  userName,
  typingContent,
  isTyping,
}: ChatBubbleProps) {
  const isUser = role === 'user'
  const displayContent = isUser ? content : (typingContent ?? content)

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* 头像 */}
      <div className="flex-shrink-0">
        {isUser ? (
          <Avatar
            src={userAvatarSrc}
            name={userName?.trim() || '我'}
            size={32}
            className="ring-1 ring-border-default"
          />
        ) : (
          <Avatar
            src={assistantAvatarSrc}
            name={memberName || 'AI'}
            size={32}
            className="ring-1 ring-border-default"
          />
        )}
      </div>

      {/* 消息气泡 */}
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-3 text-body-sm leading-relaxed',
          isUser
            ? 'bg-brand text-white rounded-tr-sm'
            : 'bg-surface border border-border-default text-ink-primary rounded-tl-sm'
        )}
      >
        {!isUser && memberName && (
          <div className="text-caption font-medium mb-1 text-ink-secondary">{memberName}</div>
        )}

        {/* 打字机内容或 loading indicator */}
        {isTyping && !displayContent ? (
          <TypingIndicator />
        ) : (
          <div className="whitespace-pre-wrap">{displayContent}</div>
        )}

        {/* 打字机进行中时显示光标 */}
        {!isUser && typingContent !== undefined && (
          <span className="inline-block w-0.5 h-4 bg-ink-muted ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  )
}
