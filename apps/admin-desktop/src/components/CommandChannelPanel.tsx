// apps/admin-desktop/src/components/CommandChannelPanel.tsx
import { useState, useEffect, useRef } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type QueryDocumentSnapshot,
  getFirestore,
} from 'firebase/firestore'
import { httpsCallable, getFunctions } from 'firebase/functions'

const db = getFirestore()
const functions = getFunctions()

interface Thread {
  id: string
  threadType: 'agency_assistance' | 'border_share'
  subject: string
  participantUids: Record<string, boolean>
  lastMessageAt?: number
}

interface Message {
  id: string
  authorUid: string
  body: string
  createdAt: number
}

interface Props {
  reportId: string
  currentUserUid: string
}

export function CommandChannelPanel({ reportId, currentUserUid }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const initialSelectionDoneRef = useRef(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'command_channel_threads'), where('reportId', '==', reportId))
    return onSnapshot(q, (snap) => {
      const found = snap.docs.map((d: QueryDocumentSnapshot) => ({
        id: d.id,
        ...(d.data() as Omit<Thread, 'id'>),
      }))
      setThreads(found)
      if (found.length > 0 && !initialSelectionDoneRef.current) {
        const first = found[0]
        if (first) {
          setActiveThreadId(first.id)
          initialSelectionDoneRef.current = true
        }
      }
    })
  }, [reportId])

  useEffect(() => {
    if (!activeThreadId) return
    const q = query(
      collection(db, 'command_channel_messages'),
      where('threadId', '==', activeThreadId),
      orderBy('createdAt', 'desc'),
      limit(50),
    )
    return onSnapshot(q, (snap) => {
      setMessages(
        snap.docs
          .map((d: QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }))
          .reverse(),
      )
    })
  }, [activeThreadId])

  async function handleSend() {
    if (!activeThreadId || !input.trim()) return
    setError(null)
    try {
      const fn = httpsCallable(functions, 'addCommandChannelMessage')
      await fn({
        threadId: activeThreadId,
        body: input.trim(),
        idempotencyKey: crypto.randomUUID(),
      })
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    }
  }

  if (threads.length === 0) return null

  const activeThread = threads.find((t) => t.id === activeThreadId)

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex gap-2">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveThreadId(t.id)
            }}
            className={`px-2 py-1 text-xs rounded ${t.id === activeThreadId ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            {t.threadType === 'agency_assistance' ? '🏥 Agency' : '🗺️ Border'}
          </button>
        ))}
      </div>

      {activeThread && <p className="text-xs text-gray-500">{activeThread.subject}</p>}

      <div className="h-48 overflow-y-auto space-y-2 border rounded p-2 bg-gray-50">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm ${m.authorUid === currentUserUid ? 'text-right' : ''}`}
          >
            <span className="text-xs text-gray-500">{m.authorUid}</span>
            <p>{m.body}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
          }}
          maxLength={2000}
          rows={2}
          className="flex-1 border rounded px-2 py-1 text-sm resize-none"
          placeholder="Type a message..."
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim()}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          Send
        </button>
      </div>
      <p className="text-xs text-right text-gray-400">{input.length}/2000</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
