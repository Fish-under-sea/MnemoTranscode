// frontend/src/components/dialogue/ChatBubble.tsx
import { cn } from '@/lib/utils'
import TypingIndicator from './TypingIndicator'
import Avatar from '@/components/ui/Avatar'
import { DialogueStickerThumb } from '@/components/dialogue/DialogueStickerThumb'

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
  /** 当前正在打字机逐字输出（为 true 时显示尾光标；勿与 isTyping 加载态混淆） */
  showTypingCaret?: boolean
  /** 当前正在打字机渲染的内容（仅最后一条 assistant 消息传入） */
  typingContent?: string
  /** 是否显示打字机 loading 状态（content 为空时） */
  isTyping?: boolean
  /** 用户轮次：extras 中的表情包 media id，气泡内展示缩略图 */
  stickerMediaIds?: number[]
  /** 助手多段气泡时隐藏头像，与同一条「轮次」视觉连续 */
  hideAvatar?: boolean
}

export default function ChatBubble({
  role,
  content,
  memberName,
  assistantAvatarSrc,
  userAvatarSrc,
  userName,
  showTypingCaret = false,
  typingContent,
  isTyping,
  stickerMediaIds,
  hideAvatar = false,
}: ChatBubbleProps) {
  const isUser = role === 'user'
  const displayContent = isUser ? content : (typingContent ?? content)

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* 头像 */}
      <div className="flex-shrink-0">
        {hideAvatar ? (
          <span className="inline-block size-8 shrink-0" aria-hidden />
        ) : isUser ? (
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
        {!isUser && memberName && !hideAvatar && (
          <div className="text-caption font-medium mb-1 text-ink-secondary">{memberName}</div>
        )}

        {/* 打字机内容或 loading indicator */}
        {isTyping && !displayContent ? (
          <TypingIndicator />
        ) : (
          <div className="whitespace-pre-wrap">{displayContent}</div>
        )}

        {isUser && stickerMediaIds && stickerMediaIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
            {stickerMediaIds.map((mid) => (
              <DialogueStickerThumb
                key={mid}
                mediaId={mid}
                className="h-14 w-14 shrink-0"
              />
            ))}
          </div>
        )}

        {/* 仅在逐字输出阶段显示尾光标，避免 typingContent 与 content 不同步时误显 */}
        {!isUser && showTypingCaret && (
          <span className="inline-block w-0.5 h-4 bg-ink-muted ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  )
}
