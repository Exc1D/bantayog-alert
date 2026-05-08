import { useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useMessages } from '../hooks/useMessages'
import { useSendMessage } from '../hooks/useSendMessage'
import { useReport } from '../hooks/useReport'
import styles from './MessageThreadPage.module.css'

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

export function MessageThreadPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { messages, loading, error: messagesError } = useMessages(reportId)
  const { send, loading: sending, error: sendError } = useSendMessage(reportId ?? '')
  const { report } = useReport(reportId)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight
    // Only auto-scroll when the user is already near the bottom; otherwise
    // they're reading older messages and we shouldn't yank them away.
    // Also scroll on first load (scrollTop === 0) so the user sees the latest messages.
    if (list.scrollTop === 0 || distance < 80) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
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

  const errorText = sendError?.message ?? messagesError ?? null
  const showEmptyState = !loading && messages.length === 0 && messagesError === null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => void navigate(-1)} aria-label="Back">
          ←
        </button>
        <h1 className={styles.headerTitle}>Incident #{reportId?.slice(0, 8) ?? ''}</h1>
        {report?.contactPhone ? (
          <a href={`tel:${report.contactPhone}`} className={styles.sendBtn} aria-label="Call Admin">
            📞
          </a>
        ) : (
          <button
            type="button"
            className={styles.sendBtn}
            disabled
            title="Admin phone not available"
            aria-label="Call Admin"
          >
            📞
          </button>
        )}
      </div>

      <div className={styles.messageList} role="log" aria-label="Messages" ref={listRef}>
        {loading && <p className={styles.loading}>Loading…</p>}
        {showEmptyState && (
          <p className={styles.emptyMessage}>No messages yet. Send the first one below.</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.authorUid === user?.uid
          return (
            <div
              key={msg.id}
              className={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]
                .filter(Boolean)
                .join(' ')}
            >
              {!isMine && <div className={styles.bubbleSender}>{msg.authorDisplayName}</div>}
              {msg.body}
              <div className={styles.bubbleTime}>{formatTime(msg.createdAt)}</div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {errorText !== null && (
        <p role="alert" className={styles.errorPill}>
          {errorText}
        </p>
      )}

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
