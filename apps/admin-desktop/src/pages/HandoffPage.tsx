import { useState, useMemo } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck,
  CheckCircle,
  X,
  Plus,
  GripVertical,
  RefreshCw,
  Copy,
  Check,
  Shield,
  FileText,
} from 'lucide-react'

const INCOMING_ADMINS = [
  { id: 'u-002', name: 'Maria dela Paz', role: 'PROVINCIAL_ADMIN' },
  { id: 'u-021', name: 'Brgy. Capt. Pedro Reyes', role: 'MUNICIPAL_ADMIN' },
  { id: 'u-022', name: 'Capt. Ana Lim', role: 'AGENCY_ADMIN' },
]

const PRIORITY_COLORS = {
  high: 'bg-red-700',
  medium: 'bg-amber-700',
  low: 'bg-green-700',
} as const

type Priority = 'high' | 'medium' | 'low'

interface PendingItem {
  id: string
  text: string
  priority: Priority
  source: string
  checked: boolean
}

export default function HandoffPage() {
  const { incidents, escalations, municipalities } = useDataStore()
  const { addToast } = useUIStore()

  const [phase, setPhase] = useState<'outgoing' | 'incoming'>('outgoing')
  const [incomingAdmin, setIncomingAdmin] = useState(INCOMING_ADMINS[0]?.id ?? '')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([
    {
      id: '1',
      text: 'Review 3 pending NDRRMC escalations',
      priority: 'high',
      source: 'Auto-generated from escalations',
      checked: false,
    },
    {
      id: '2',
      text: 'Monitor Vinzons landslide (L-2024-0231)',
      priority: 'high',
      source: 'Auto-generated from incidents',
      checked: false,
    },
    {
      id: '3',
      text: 'Follow up on Labo mass evacuation',
      priority: 'high',
      source: 'Auto-generated from incidents',
      checked: false,
    },
    {
      id: '4',
      text: 'Approve data erasure request er-001',
      priority: 'medium',
      source: 'Auto-generated from system',
      checked: false,
    },
    {
      id: '5',
      text: 'Check SMS gateway provider health',
      priority: 'medium',
      source: 'Auto-generated from system',
      checked: false,
    },
    {
      id: '6',
      text: 'Review overnight incident reports',
      priority: 'low',
      source: 'General',
      checked: false,
    },
  ])
  const [notes, setNotes] = useState(
    'High activity shift. Vinzons and Labo require continued attention. SMS gateway degraded - monitor provider health.',
  )
  const [generated, setGenerated] = useState(false)
  const [token, setToken] = useState('')
  const [handoffAccepted, setHandoffAccepted] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemText, setNewItemText] = useState('')
  const [newItemPriority, setNewItemPriority] = useState<Priority>('medium')

  const activeIncidents = incidents.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'CRITICAL' || i.status === 'ESCALATED',
  )
  const pendingEscalations = escalations.filter((e) => e.status === 'PENDING')

  const snapshot = useMemo(
    () => ({
      activeIncidents: activeIncidents.length,
      highSeverity: activeIncidents.filter((i) => i.severity === 'HIGH').length,
      mediumSeverity: activeIncidents.filter((i) => i.severity === 'MEDIUM').length,
      lowSeverity: activeIncidents.filter((i) => i.severity === 'LOW').length,
      pendingEscalations: pendingEscalations.length,
      activeResponders: municipalities.reduce((sum, m) => sum + m.activeResponders, 0),
      municipalitiesAffected: municipalities.filter((m) => m.activeIncidents > 0).length,
    }),
    [activeIncidents, pendingEscalations, municipalities],
  )

  const allAcknowledged = pendingItems.every((i) => i.checked)
  const acknowledgedCount = pendingItems.filter((i) => i.checked).length

  const handleGenerate = () => {
    const newToken = `HOFF-${String(new Date().getFullYear())}-${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
    setToken(newToken)
    setGenerated(true)
    addToast({
      title: 'Handoff generated',
      message: 'Handoff package ready for incoming admin.',
      type: 'success',
    })
  }

  const handleAccept = () => {
    setHandoffAccepted(true)
    addToast({
      title: 'Command assumed',
      message: 'Welcome, Maria dela Paz. You are now in command.',
      type: 'success',
    })
  }

  const toggleItem = (id: string) => {
    setPendingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    )
  }

  const addItem = () => {
    if (!newItemText.trim()) return
    setPendingItems((prev) => [
      ...prev,
      {
        id: `item-${String(Date.now())}`,
        text: newItemText,
        priority: newItemPriority,
        source: 'Manual entry',
        checked: false,
      },
    ])
    setNewItemText('')
    setShowAddItem(false)
  }

  const removeItem = (id: string) => {
    setPendingItems((prev) => prev.filter((i) => i.id !== id))
  }

  const incomingAdminData = INCOMING_ADMINS.find((a) => a.id === incomingAdmin)

  return (
    <AppShell>
      <div className="p-6 max-w-[1000px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Shift Handoff</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              {phase === 'outgoing'
                ? 'Generate handoff package for incoming admin'
                : 'Review and accept command from outgoing admin'}
            </p>
          </div>
          <div className="flex items-center bg-white border border-border rounded-lg p-1">
            <button
              onClick={() => {
                setPhase('outgoing')
              }}
              className={cn(
                'px-4 py-2 rounded-md text-body-sm font-medium transition-all',
                phase === 'outgoing'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Outgoing
            </button>
            <button
              onClick={() => {
                setPhase('incoming')
              }}
              className={cn(
                'px-4 py-2 rounded-md text-body-sm font-medium transition-all',
                phase === 'incoming'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Incoming
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'outgoing' ? (
            <motion.div
              key="outgoing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white border border-border rounded-lg p-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-foreground text-xl font-medium">
                    RC
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">Engr. Ricardo Cruz</h3>
                    <p className="text-body-sm text-muted-foreground">
                      Superadmin &mdash; PDRRMO Camarines Norte
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      On duty: 08:00 &mdash; 20:00 (12h 0m)
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Session active &middot; TOTP verified 3h ago
                    </p>
                  </div>
                  <button className="px-3 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-xs font-medium hover:bg-red-100 transition-colors">
                    End my session
                  </button>
                </div>
              </div>

              {!generated && (
                <div className="bg-white border border-border rounded-lg p-5">
                  <span className="text-lg font-semibold text-foreground block mb-3">
                    Select Incoming Admin
                  </span>
                  <select
                    value={incomingAdmin}
                    onChange={(e) => {
                      setIncomingAdmin(e.target.value)
                    }}
                    className="w-full max-w-sm px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground focus:outline-none focus:border-accent"
                  >
                    {INCOMING_ADMINS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} &mdash; {a.role.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-white border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Province Snapshot</h3>
                    <p className="text-xs text-muted-foreground/70">
                      Auto-generated from live data. Review and edit as needed.
                    </p>
                  </div>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-xs text-muted-foreground/70 uppercase">Active Incidents</p>
                      <p className="text-display-md text-foreground font-mono">
                        {snapshot.activeIncidents}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="text-red-700">{snapshot.highSeverity} HIGH</span> &middot;{' '}
                        <span className="text-amber-700">{snapshot.mediumSeverity} MED</span>{' '}
                        &middot; <span className="text-green-700">{snapshot.lowSeverity} LOW</span>
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-xs text-muted-foreground/70 uppercase">
                        Active Responders
                      </p>
                      <p className="text-display-md text-foreground font-mono">
                        {snapshot.activeResponders}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Across all agencies</p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-xs text-muted-foreground/70 uppercase">
                        Pending Escalations
                      </p>
                      <p className="text-display-md text-purple-700 font-mono">
                        {snapshot.pendingEscalations}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">NDRRMC review</p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-xs text-muted-foreground/70 uppercase">
                        Municipalities Affected
                      </p>
                      <p className="text-display-md text-foreground font-mono">
                        {snapshot.municipalitiesAffected}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">of 12 total</p>
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-body-sm text-foreground">
                        <span className="text-red-700 font-medium">
                          1 active emergency declaration:
                        </span>{' '}
                        FLOOD (Province-wide, declared 14:35)
                      </p>
                      <FileText className="w-4 h-4 text-muted-foreground/70" />
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-body-sm text-foreground">
                      <span className="text-green-700 font-medium">All systems operational</span>{' '}
                      &middot; SMS queue: 23 messages
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-border rounded-lg p-5">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Pending Items for Incoming Admin
                </h3>
                <p className="text-xs text-muted-foreground/70 mb-4">
                  Checklist of items requiring attention
                </p>
                <div className="space-y-2">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 bg-muted rounded-lg group"
                    >
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          PRIORITY_COLORS[item.priority],
                        )}
                      />
                      <GripVertical className="w-4 h-4 text-muted-foreground/70 opacity-0 group-hover:opacity-100 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm text-foreground">{item.text}</p>
                        <p className="text-xs text-muted-foreground/70">{item.source}</p>
                      </div>
                      <button
                        onClick={() => {
                          removeItem(item.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white text-muted-foreground/70 hover:text-red-700 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {showAddItem ? (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={newItemText}
                      onChange={(e) => {
                        setNewItemText(e.target.value)
                      }}
                      placeholder="Enter item text..."
                      className="flex-1 px-3 py-2 bg-white border border-border rounded-md text-body-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addItem()
                      }}
                    />
                    <select
                      value={newItemPriority}
                      onChange={(e) => {
                        setNewItemPriority(e.target.value as Priority)
                      }}
                      className="px-2 py-2 bg-white border border-border rounded-md text-xs text-foreground"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button
                      onClick={addItem}
                      className="px-3 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-all"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddItem(false)
                      }}
                      className="p-2 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowAddItem(true)
                    }}
                    className="mt-3 flex items-center gap-2 text-body-sm text-muted-foreground hover:text-accent transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add pending item
                  </button>
                )}
              </div>

              <div className="bg-white border border-border rounded-lg p-5">
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  Notes for Incoming Admin
                </h3>
                <textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value)
                  }}
                  rows={5}
                  placeholder="Enter any important context, observations, or instructions..."
                  className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent resize-none"
                />
                <p className="text-xs text-muted-foreground/70 mt-2">Draft saved automatically</p>
              </div>

              {!generated ? (
                <div className="flex justify-center pb-6">
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-2 px-8 py-3 rounded-md bg-accent text-white text-lg font-medium hover:bg-accent-hover transition-all shadow-lg"
                  >
                    <ClipboardCheck className="w-5 h-5" />
                    Generate Handoff Package
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-muted border border-accent/30 rounded-lg p-6 text-center"
                >
                  <CheckCircle className="w-10 h-10 text-green-700 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-foreground mb-2">
                    Handoff Package Ready
                  </p>
                  <p className="text-body-sm text-muted-foreground mb-4">
                    Share this token with {incomingAdminData?.name}
                  </p>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <code className="px-4 py-2 bg-white border border-border rounded-md text-sm font-mono text-accent font-medium">
                      {token}
                    </code>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(token)
                        addToast({
                          title: 'Copied',
                          message: 'Handoff token copied to clipboard.',
                          type: 'success',
                        })
                      }}
                      className="p-2 rounded-md bg-white border border-border text-muted-foreground hover:text-accent hover:border-accent transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    Token expires in 4 hours &middot; Single-use only
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        setGenerated(false)
                        setToken('')
                      }}
                      className="px-4 py-2 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-white transition-colors"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => {
                        setPhase('incoming')
                      }}
                      className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
                    >
                      Preview Incoming View
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="incoming"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {handoffAccepted ? (
                <div className="bg-white border border-green-300 rounded-lg p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                  >
                    <Shield className="w-16 h-16 text-green-700 mx-auto mb-4" />
                  </motion.div>
                  <h2 className="text-2xl font-semibold text-green-700 mb-2">Command Assumed</h2>
                  <p className="text-body-md text-foreground mb-1">
                    Welcome, Maria dela Paz. You are now the active superadmin.
                  </p>
                  <p className="text-body-sm text-muted-foreground">
                    Handoff accepted at {new Date().toLocaleTimeString()}
                  </p>
                  <button
                    onClick={() => {
                      setHandoffAccepted(false)
                      setPhase('outgoing')
                      setGenerated(false)
                      setToken('')
                      setPendingItems((prev) => prev.map((i) => ({ ...i, checked: false })))
                    }}
                    className="mt-6 px-6 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
                  >
                    Start New Handoff
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-white border border-border rounded-lg p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-foreground text-xl font-medium">
                        MP
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">Maria dela Paz</h3>
                        <p className="text-body-sm text-muted-foreground">
                          Provincial Admin &mdash; PDRRMO Camarines Norte
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Assuming command at: 20:00
                        </p>
                      </div>
                      <div className="px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                        Incoming
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-border rounded-lg p-5">
                    <span className="text-lg font-semibold text-foreground block mb-3">
                      Handoff Token
                    </span>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Enter handoff token..."
                        className="flex-1 px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent font-mono"
                      />
                      <button className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all">
                        Verify
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-border rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground">Snapshot Review</h3>
                      <span className="text-xs text-muted-foreground/70">
                        Generated 19:45 by Engr. Ricardo Cruz
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-body-sm text-foreground">
                          <span className="font-medium">
                            {snapshot.activeIncidents} active incidents
                          </span>{' '}
                          province-wide
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {snapshot.highSeverity} HIGH &middot; {snapshot.mediumSeverity} MEDIUM
                          &middot; {snapshot.lowSeverity} LOW
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Most affected: Vinzons (12), Daet (8), Labo (7)
                        </p>
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-body-sm text-foreground">
                          <span className="font-medium">
                            {snapshot.activeResponders} responders active
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Avg response time: 14:32 &middot;{' '}
                          <span className="text-red-700">9 incidents unresolved &gt;24h</span>
                        </p>
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-body-sm text-foreground">
                          <span className="text-purple-700 font-medium">
                            {snapshot.pendingEscalations} escalations pending review
                          </span>
                        </p>
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-body-sm text-red-700">
                          <span className="font-medium">1 active emergency declaration:</span> FLOOD
                          (Province-wide, declared 14:35)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-border rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        Pending Items Checklist
                      </h3>
                      <span className="text-body-sm text-muted-foreground">
                        {acknowledgedCount}/{pendingItems.length} acknowledged
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full mb-4 overflow-hidden">
                      <motion.div
                        className="h-full bg-accent rounded-full"
                        initial={false}
                        animate={{
                          width: `${String((acknowledgedCount / pendingItems.length) * 100)}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="space-y-2">
                      {pendingItems.map((item) => (
                        <label
                          key={item.id}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all',
                            item.checked ? 'bg-muted' : 'hover:bg-muted/50',
                          )}
                        >
                          <div
                            className={cn(
                              'w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                              item.checked ? 'bg-accent border-accent' : 'border-border',
                            )}
                          >
                            {item.checked && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div
                            className="flex-1"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') toggleItem(item.id)
                            }}
                            onClick={() => {
                              toggleItem(item.id)
                            }}
                          >
                            <p
                              className={cn(
                                'text-body-sm',
                                item.checked
                                  ? 'text-muted-foreground line-through'
                                  : 'text-foreground',
                              )}
                            >
                              {item.text}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  PRIORITY_COLORS[item.priority],
                                )}
                              />
                              <span className="text-xs text-muted-foreground/70">
                                {item.source}
                              </span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted border-l-4 border-l-accent rounded-r-lg p-5">
                    <p className="text-xs text-muted-foreground mb-2">
                      Notes from Engr. Ricardo Cruz
                    </p>
                    <p className="text-body-md text-foreground italic">&ldquo;{notes}&rdquo;</p>
                  </div>

                  <div className="flex justify-center pb-6">
                    <button
                      onClick={handleAccept}
                      disabled={!allAcknowledged}
                      className={cn(
                        'flex items-center gap-2 px-8 py-3 rounded-md text-lg font-medium transition-all',
                        allAcknowledged
                          ? 'bg-accent text-white hover:bg-accent-hover shadow-lg'
                          : 'bg-muted text-muted-foreground/70 cursor-not-allowed border border-border',
                      )}
                    >
                      <ClipboardCheck className="w-5 h-5" />
                      Accept Handoff & Assume Command
                    </button>
                  </div>
                  {!allAcknowledged && (
                    <p className="text-center text-xs text-muted-foreground/70 -mt-4 mb-4">
                      Acknowledge all pending items to accept handoff
                    </p>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
