/**
 * AI 对话页面
 */
import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Send, Loader2, Trash2 } from 'lucide-react'
import { dialogueApi, archiveApi } from '@/services/api'
import ChatBubble from '@/components/voice/ChatBubble'

export default function DialoguePage() {
  const { archiveId, memberId } = useParams<{ archiveId?: string; memberId?: string }>()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: archive } = useQuery({
    queryKey: ['archive', archiveId],
    queryFn: () => archiveApi.get(Number(archiveId)) as any,
    enabled: !!archiveId,
  })

  const { data: member } = useQuery({
    queryKey: ['member', archiveId, memberId],
    queryFn: () => archiveApi.getMember(Number(archiveId), Number(memberId)) as any,
    enabled: !!archiveId && !!memberId,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!message.trim() || loading) return
    const userMsg = message.trim()
    setMessage('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const response = await dialogueApi.chat({
        message: userMsg,
        archive_id: archiveId ? Number(archiveId) : undefined,
        member_id: memberId ? Number(memberId) : undefined,
        channel: 'app',
        session_id: sessionId,
        history_limit: 10,
      }) as any

      setMessages((prev) => [...prev, { role: 'assistant', content: response.reply }])
    } catch (error: any) {
      toast.error(error.detail || '发送失败')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = async () => {
    setMessages([])
    try {
      await dialogueApi.clearHistory(sessionId)
    } catch {}
  }

  const memberName = member?.name || archive?.name || 'AI 助手'

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">与 {memberName} 对话</h1>
          <p className="text-sm text-gray-500">
            {member?.relationship && `关系: ${member.relationship}`} · 渠道: 应用内
          </p>
        </div>
        <button
          onClick={handleClear}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-base"
          title="清空对话"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-200 p-4 space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="text-4xl mb-4">{member?.relationship ? '💬' : '🤖'}</div>
            <p className="text-center">
              {memberId
                ? `和 ${memberName} 开始对话吧，ta 记得你们的故事`
                : '选择一个档案或成员开始对话'}
            </p>
            {(archiveId || memberId) && (
              <p className="text-sm mt-2 text-gray-400">
                暂无对话历史，开始你们的第一次对话
              </p>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <ChatBubble
                key={index}
                role={msg.role}
                content={msg.content}
                memberName={memberName}
              />
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center text-accent-green">
                  {memberName.charAt(0)}
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`对 ${memberName} 说些什么...`}
            rows={1}
            className="flex-1 resize-none outline-none text-sm max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-base flex items-center gap-2"
          >
            <Send size={16} />
            <span className="hidden sm:inline">发送</span>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </div>
  )
}
