import { useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useMessages } from '../hooks/useMessages'
import { useSendMessage } from '../hooks/useSendMessage'
import styles from './MessageThreadPage.module.css'

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

export function MessageThreadPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { messages, loading } = useMessages(reportId)
  const { send, loading: sending } = useSendMessage(reportId ?? '')
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend() {
    const text = draft.trim()
    if (!text || reportId === undefined) return
    setDraft('')
    try {
      await send(text)
    } catch (err: unknown) {
      console.error('[MessageThreadPage] send failed:', err)
      setDraft(text)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => void navigate(-1)} aria-label="Back">
          ←
        </button>
        <h1 className={styles.headerTitle}>Incident #{reportId?.slice(0, 8) ?? ''}</h1>
      </div>

      <div className={styles.messageList} role="log" aria-label="Messages">
        {loading && <p className={styles.loading}>Loading…</p>}
        {messages.map((msg) => {
          const isMine = msg.senderRole === 'responder'
          return (
            <div
              key={msg.id}
              className={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]
                .filter(Boolean)
                .join(' ')}
            >
              {!isMine && <div className={styles.bubbleSender}>{msg.senderDisplayName}</div>}
              {msg.content}
              <div className={styles.bubbleTime}>{formatTime(msg.sentAt)}</div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <textarea
          className={styles.msgInput}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Type a message…"
          aria-label="Message input"
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={() => void handleSend()}
          disabled={!draft.trim() || sending || !user}
          aria-label="Send message"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
