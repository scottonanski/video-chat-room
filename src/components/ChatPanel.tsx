import { useEffect, useRef, useCallback, type FormEvent } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  sender_name: string
  message: string
  timestamp: string
}

const QUICK_EMOJIS = ['👍', '🔥', '😂', '🎉', '❤️']

interface ChatPanelProps {
  currentUser: string
  messages: ChatMessage[]
  chatInput: string
  onChatInputChange: (value: string) => void
  onSendChatMessage: (e: FormEvent) => void
  onSendEmoji: (emoji: string) => void
  unreadCount: number
  onResetUnread: () => void
}

function formatTime(timestamp: string) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const EMOJI_ONLY_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]+$/u

function ChatBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  const isEmojiOnly = EMOJI_ONLY_RE.test(msg.message.trim())

  return (
    <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
      {!isOwn && (
        <span className="mb-0.5 ml-2 text-[11px] font-semibold text-primary">
          {msg.sender_name}
        </span>
      )}
      {isEmojiOnly ? (
        <p className="text-3xl leading-relaxed">{msg.message}</p>
      ) : (
        <div
          className={cn(
            'max-w-[85%] rounded px-3 py-1',
            isOwn
              ? 'rounded-br-none bg-primary text-primary-foreground'
              : 'rounded-bl-sm rounded-br-none bg-muted text-foreground',
          )}
        >
          <p className="text-sm font-semibold leading-relaxed">{msg.message}</p>
        </div>
      )}
      <span
        className={cn(
          'mt-0.5 text-[12px] text-muted-foreground',
          isOwn ? 'mr-2' : 'ml-2',
        )}
      >
        {formatTime(msg.timestamp)}
      </span>
    </div>
  )
}

export default function ChatPanel({
  currentUser,
  messages,
  chatInput,
  onChatInputChange,
  onSendChatMessage,
  onSendEmoji,
  unreadCount,
  onResetUnread,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const bottomObserverCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const isVisible = entries[0]?.isIntersecting ?? false
      isAtBottomRef.current = isVisible
      if (isVisible) onResetUnread()
    },
    [onResetUnread],
  )

  useEffect(() => {
    const el = messagesEndRef.current
    if (!el) return
    const observer = new IntersectionObserver(bottomObserverCallback, { threshold: 1.0 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [bottomObserverCallback])

  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-heading text-sm font-semibold">Chat</h2>
        {unreadCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No messages yet
            </p>
          )}
          {messages.map((msg, index) => (
            <ChatBubble
              key={index}
              msg={msg}
              isOwn={msg.sender_name === currentUser}
            />
          ))}
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>

      <div className="flex gap-1 justify-center border-t border-border px-3 pt-2">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSendEmoji(emoji)}
            className="text-lg hover:scale-125 transition-transform px-1"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="border-border px-3 pb-3 pt-1 flex">
        <form onSubmit={onSendChatMessage} className="flex flex-1 items-center justify-center gap-2">
          <Input
            type="text"
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!chatInput.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
