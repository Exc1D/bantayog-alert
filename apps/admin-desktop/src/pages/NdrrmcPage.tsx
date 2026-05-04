import { useState, useMemo } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import type { EscalationRequest, Report } from '@/types'
import {
  ArrowUpRight,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  Image,
  X,
  Send,
  Save,
  Play,
} from 'lucide-react'

const STATUS_OPTIONS = ['ALL', 'PENDING', 'APPROVED', 'DECLINED'] as const
const SEVERITY_OPTIONS = ['HIGH', 'MEDIUM', 'LOW'] as const

const FORWARD_METHODS = [
  {
    id: 'phone',
    label: 'Phone Call',
    desc: 'Direct hotline to NDRRMC Ops Center',
    icon: Phone,
    contact: '+63 2 XXX XXXX',
  },
  {
    id: 'email',
    label: 'Email',
    desc: 'Formal documentation channel',
    icon: Mail,
    contact: 'ops@ndrrmc.gov.ph',
  },
  {
    id: 'form',
    label: 'Formal NDRRMC Form',
    desc: 'Submit through official online portal',
    icon: FileText,
    contact: 'Auto-fill from data',
  },
] as const

const DECLINE_REASONS = [
  'Within municipal capacity \u2014 no national support needed',
  'Insufficient evidence \u2014 request more documentation',
  'Duplicate request',
  'Incorrect severity assessment',
  'Custom reason',
]

function getIncidentForEscalation(escId: string, incidents: Report[]): Report | undefined {
  const escMap: Record<string, string> = {
    'esc-001': 'F-2024-0855',
    'esc-002': 'L-2024-0231',
    'esc-003': 'F-2024-0859',
  }
  return incidents.find((i) => i.id === escMap[escId])
}

export default function NdrrmcPage() {
  const { escalations, incidents, municipalities } = useDataStore()
  const { addToast } = useUIStore()

  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [severityFilter, setSeverityFilter] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedEsc, setSelectedEsc] = useState<EscalationRequest | null>(null)
  const [messageDraft, setMessageDraft] = useState('')
  const [forwardMethod, setForwardMethod] = useState<string>('email')
  const [declineModalOpen, setDeclineModalOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [forwardConfirmOpen, setForwardConfirmOpen] = useState(false)
  const [forwardStep, setForwardStep] = useState<1 | 2>(1)
  const [successState, setSuccessState] = useState<{ ref: string; method: string } | null>(null)
  const [processing, setProcessing] = useState(false)

  const [now] = useState(() => Date.now())

  const filteredEscalations = useMemo(() => {
    let result = [...escalations]
    if (statusFilter !== 'ALL') result = result.filter((e) => e.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.municipality.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q),
      )
    }
    if (severityFilter.length > 0) {
      result = result.filter((e) => {
        const inc = getIncidentForEscalation(e.id, incidents)
        return inc && severityFilter.includes(inc.severity)
      })
    }
    return result
  }, [escalations, statusFilter, search, severityFilter, incidents])

  const pendingCount = escalations.filter((e) => e.status === 'PENDING').length
  const forwardedCount = escalations.filter((e) => e.status === 'APPROVED').length
  const declinedCount = escalations.filter((e) => e.status === 'DECLINED').length

  const handleSelect = (esc: EscalationRequest) => {
    setSelectedEsc(esc)
    const inc = getIncidentForEscalation(esc.id, incidents)
    setMessageDraft(
      `TO: NDRRMC Operations Center\nFROM: Camarines Norte PDRRMO\nRE: Escalation Request \u2014 ${inc?.type ?? 'INCIDENT'} \u2014 ${esc.municipality}\n\nIncident: ${inc?.id ?? 'N/A'}\nSeverity: ${inc?.severity ?? 'N/A'}\nMunicipality: ${esc.municipality}\nAffected: ~120 families\nResponders assigned: ${String(inc?.responderCount ?? 0)}\n\n${esc.reason}\n\nContact: PDRRMO Camarines Norte \u2014 +63 XXX XXX XXXX`,
    )
  }

  const handleDecline = () => {
    if (!selectedEsc) return
    const reason = declineReason === 'Custom reason' ? customReason : declineReason
    addToast({
      title: 'Escalation declined',
      message: `${selectedEsc.id} declined. Reason: ${reason}`,
      type: 'warning',
    })
    setDeclineModalOpen(false)
    setDeclineReason('')
    setCustomReason('')
    setSelectedEsc(null)
  }

  const handleForward = () => {
    if (forwardStep === 1) {
      setForwardStep(2)
      return
    }
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      setForwardConfirmOpen(false)
      setForwardStep(1)
      setSuccessState({
        ref: `${selectedEsc?.id.replace('esc', 'ESC') ?? ''}-FWD-${Date.now().toString().slice(-4)}`,
        method: forwardMethod,
      })
      addToast({
        title: 'Escalation forwarded',
        message: `${selectedEsc?.id ?? ''} forwarded to NDRRMC via ${forwardMethod}`,
        type: 'success',
      })
    }, 1500)
  }

  const selectedIncident = selectedEsc
    ? getIncidentForEscalation(selectedEsc.id, incidents)
    : undefined
  const muniData = selectedEsc
    ? municipalities.find((m) => m.name === selectedEsc.municipality)
    : undefined

  return (
    <AppShell>
      <div className="h-[calc(100dvh-56px)] flex flex-col">
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">NDRRMC Escalation Queue</h1>
              <p className="text-body-sm text-muted-foreground mt-1">
                Review and forward escalation requests to national authorities
              </p>
            </div>
            <div className="text-right">
              <p className="text-body-sm text-muted-foreground">
                <span className="text-amber-700 font-medium">{pendingCount} pending</span> &middot;{' '}
                <span className="text-green-700">{forwardedCount} forwarded this month</span>{' '}
                &middot; <span className="text-red-700">{declinedCount} declined</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[40%] min-w-[360px] border-r border-border flex flex-col bg-white">
            <div className="p-4 border-b border-border space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                  }}
                  placeholder="Search by ID, municipality, type..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-md text-body-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStatusFilter(s)
                    }}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                      statusFilter === s
                        ? 'bg-muted border-accent text-accent'
                        : 'bg-white border-border text-muted-foreground hover:border-muted-foreground/30',
                    )}
                  >
                    {s === 'ALL' ? 'All' : s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/70">Severity:</span>
                {SEVERITY_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSeverityFilter((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                      )
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium border transition-all',
                      severityFilter.includes(s)
                        ? s === 'HIGH'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : s === 'MEDIUM'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-white border-border text-muted-foreground/70',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {filteredEscalations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <CheckCircle className="w-12 h-12 text-green-700 mb-3" />
                  <p className="text-body-md text-muted-foreground">
                    No escalation requests in queue
                  </p>
                  <p className="text-body-sm text-muted-foreground/70 mt-1">
                    All clear \u2014 province is handling all incidents within capacity.
                  </p>
                </div>
              ) : (
                filteredEscalations.map((esc) => {
                  const inc = getIncidentForEscalation(esc.id, incidents)
                  const age = formatDistanceToNow(new Date(esc.createdAt), { addSuffix: false })
                  const ageHours = (now - new Date(esc.createdAt).getTime()) / 36e5
                  return (
                    <motion.div
                      key={esc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'bg-white border rounded-lg p-4 cursor-pointer transition-all',
                        selectedEsc?.id === esc.id
                          ? 'border-purple-700 border-l-4 bg-purple-50'
                          : 'border-border hover:border-muted-foreground/30',
                      )}
                      onClick={() => {
                        handleSelect(esc)
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-mono text-purple-700 font-medium">
                          #{esc.id.toUpperCase()}
                        </span>
                        <StatusBadge
                          status={
                            esc.status === 'APPROVED'
                              ? 'ACTIVE'
                              : esc.status === 'DECLINED'
                                ? 'RESOLVED'
                                : 'PENDING'
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {inc && <SeverityBadge severity={inc.severity} />}
                        <span className="text-body-sm text-foreground font-medium">
                          {inc?.type ?? 'INCIDENT'}
                        </span>
                        <span className="text-xs text-muted-foreground/70">&middot;</span>
                        <span className="text-body-sm text-muted-foreground">
                          {esc.municipality}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 line-clamp-2 mb-2">
                        {esc.reason}
                      </p>
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            ageHours > 8
                              ? 'text-red-700'
                              : ageHours > 4
                                ? 'text-amber-700'
                                : 'text-muted-foreground/70',
                          )}
                        >
                          <Clock className="w-3 h-3 inline mr-1" />
                          {age} old
                        </span>
                        <span className="text-xs text-accent">Review &rarr;</span>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex-1 bg-white overflow-y-auto">
            {!selectedEsc ? (
              <div className="flex flex-col items-center justify-center h-full">
                <ArrowUpRight className="w-16 h-16 text-muted-foreground/70 mb-4" />
                <p className="text-body-md text-muted-foreground">
                  Select an escalation request to review
                </p>
              </div>
            ) : (
              <motion.div
                key={selectedEsc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 space-y-6 max-w-[800px]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-body-md font-mono text-purple-700 font-medium">
                        #{selectedEsc.id.toUpperCase()}
                      </span>
                      <StatusBadge
                        status={
                          selectedEsc.status === 'APPROVED'
                            ? 'ACTIVE'
                            : selectedEsc.status === 'DECLINED'
                              ? 'RESOLVED'
                              : 'PENDING'
                        }
                      />
                    </div>
                    <p className="text-body-sm text-muted-foreground">
                      Submitted{' '}
                      {formatDistanceToNow(new Date(selectedEsc.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {selectedEsc.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setForwardConfirmOpen(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-purple-700 text-white text-body-sm font-medium hover:bg-purple-800 transition-all"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        Forward to NDRRMC
                      </button>
                      <button
                        onClick={() => {
                          setDeclineModalOpen(true)
                        }}
                        className="px-4 py-2 rounded-md bg-red-50 text-red-700 border border-red-200 text-body-sm font-medium hover:bg-red-100 transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-border rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Request Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground/70 uppercase">Incident Type</p>
                      <p className="text-body-md text-foreground font-medium">
                        {selectedIncident?.type ?? 'N/A'}{' '}
                        {selectedIncident?.type === 'FLOOD'
                          ? '(BAHA)'
                          : selectedIncident?.type === 'LANDSLIDE'
                            ? '(GUHO)'
                            : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/70 uppercase">Severity</p>
                      {selectedIncident && <SeverityBadge severity={selectedIncident.severity} />}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/70 uppercase">Municipality</p>
                      <p className="text-body-md text-foreground">{selectedEsc.municipality}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/70 uppercase">Barangay</p>
                      <p className="text-body-md text-foreground">
                        {selectedIncident?.barangay ?? 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/70 uppercase">Requested By</p>
                      <p className="text-body-md text-foreground">{selectedEsc.requestedBy}</p>
                      <p className="text-xs text-muted-foreground/70">
                        {selectedEsc.requesterRole.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/70 uppercase">
                        Responders Assigned
                      </p>
                      <p className="text-body-md text-foreground font-mono">
                        {selectedIncident?.responderCount ?? 0}
                      </p>
                    </div>
                  </div>
                </div>

                {muniData && (
                  <div className="bg-white border border-border rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Municipality Status: {muniData.name}
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground/70 uppercase">
                          Active Incidents
                        </p>
                        <p className="text-display-md text-red-700 font-mono">
                          {muniData.activeIncidents}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/70 uppercase">Avg Response</p>
                        <p className="text-display-md text-foreground font-mono">
                          {muniData.avgResponseTime}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/70 uppercase">
                          Unresolved &gt;24h
                        </p>
                        <p className="text-display-md text-amber-700 font-mono">
                          {muniData.unresolvedOver24h}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/70 uppercase">
                          Active Responders
                        </p>
                        <p className="text-display-md text-green-700 font-mono">
                          {muniData.activeResponders}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-border rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-1">Evidence Pack</h3>
                  <p className="text-xs text-muted-foreground/70 mb-4">
                    All evidence attached to this escalation
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedEsc.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="bg-muted border border-border rounded-lg p-3 flex items-center gap-2 hover:border-muted-foreground/30 transition-colors cursor-pointer"
                      >
                        {ev.endsWith('.mp4') ? (
                          <Play className="w-5 h-5 text-accent" />
                        ) : (
                          <Image className="w-5 h-5 text-accent" />
                        )}
                        <span className="text-xs text-muted-foreground truncate">{ev}</span>
                      </div>
                    ))}
                  </div>
                  {selectedEsc.evidence.length === 0 && (
                    <p className="text-body-sm text-muted-foreground/70">No evidence attached.</p>
                  )}
                </div>

                {selectedEsc.status === 'PENDING' && (
                  <div className="bg-white border border-border rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Escalation Message Draft
                    </h3>
                    <textarea
                      value={messageDraft}
                      onChange={(e) => {
                        setMessageDraft(e.target.value)
                      }}
                      rows={12}
                      className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-accent resize-none"
                    />
                    <p className="text-xs text-muted-foreground/70 mt-2 text-right">
                      {messageDraft.length} / 2000 characters
                    </p>
                  </div>
                )}

                {selectedEsc.status === 'PENDING' && (
                  <div className="bg-white border border-border rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Forward Method</h3>
                    <div className="space-y-3">
                      {FORWARD_METHODS.map((method) => {
                        const Icon = method.icon
                        return (
                          <label
                            key={method.id}
                            aria-label={method.label}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                              forwardMethod === method.id
                                ? 'border-purple-700 bg-purple-50'
                                : 'border-border hover:border-muted-foreground/30',
                            )}
                          >
                            <input
                              type="radio"
                              name="forwardMethod"
                              value={method.id}
                              checked={forwardMethod === method.id}
                              onChange={() => {
                                setForwardMethod(method.id)
                              }}
                              className="mt-1 accent-purple-700"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <span className="text-body-sm text-foreground font-medium">
                                  {method.label}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                {method.desc}
                              </p>
                              <p className="text-xs text-accent font-mono mt-1">{method.contact}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {selectedEsc.status !== 'PENDING' && (
                  <div className="bg-white border border-border rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Resolution Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-body-sm">
                        <span className="text-muted-foreground">Status</span>
                        <StatusBadge
                          status={selectedEsc.status === 'APPROVED' ? 'ACTIVE' : 'RESOLVED'}
                        />
                      </div>
                      {selectedEsc.reviewedBy && (
                        <div className="flex justify-between text-body-sm">
                          <span className="text-muted-foreground">Reviewed By</span>
                          <span className="text-foreground">{selectedEsc.reviewedBy}</span>
                        </div>
                      )}
                      {selectedEsc.reviewedAt && (
                        <div className="flex justify-between text-body-sm">
                          <span className="text-muted-foreground">Reviewed At</span>
                          <span className="text-foreground font-mono">
                            {new Date(selectedEsc.reviewedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedEsc.reviewNotes && (
                        <div className="mt-3 p-3 bg-muted border-l-2 border-accent rounded-r">
                          <p className="text-body-sm text-muted-foreground italic">
                            &ldquo;{selectedEsc.reviewNotes}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedEsc.status === 'PENDING' && (
                  <div className="sticky bottom-0 bg-muted border-t border-border p-5 -mx-6 -mb-6 flex items-center gap-3">
                    <button
                      onClick={() => {
                        setForwardConfirmOpen(true)
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-purple-700 text-white text-body-sm font-medium hover:bg-purple-800 transition-all"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Forward to NDRRMC
                    </button>
                    <button
                      onClick={() => {
                        setDeclineModalOpen(true)
                      }}
                      className="px-5 py-2.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-body-sm font-medium hover:bg-red-100 transition-all"
                    >
                      Decline with Reason
                    </button>
                    <button
                      onClick={() => {
                        addToast({
                          title: 'Draft saved',
                          message: 'Escalation draft saved successfully.',
                          type: 'info',
                        })
                      }}
                      className="px-5 py-2.5 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-white transition-colors"
                    >
                      <Save className="w-4 h-4 inline mr-1" />
                      Save Draft
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {declineModalOpen && selectedEsc && (
          <Modal
            onClose={() => {
              setDeclineModalOpen(false)
            }}
            title="Decline Escalation Request"
            maxWidth="480px"
          >
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <p className="text-body-sm text-red-700">
                  This action will notify the municipal admin that their request was declined.
                </p>
              </div>
              <div>
                <span className="text-body-sm text-muted-foreground block mb-2">Reason</span>
                <div className="space-y-2">
                  {DECLINE_REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="declineReason"
                        value={r}
                        checked={declineReason === r}
                        onChange={() => {
                          setDeclineReason(r)
                        }}
                        className="accent-accent"
                      />
                      <span className="text-body-sm text-foreground">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              {declineReason === 'Custom reason' && (
                <div>
                  <span className="text-body-sm text-muted-foreground block mb-2">
                    Custom Reason
                  </span>
                  <textarea
                    value={customReason}
                    onChange={(e) => {
                      setCustomReason(e.target.value)
                    }}
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-border rounded-md text-body-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent resize-none"
                    placeholder="Enter custom reason..."
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="accent-accent" />
                <span className="text-body-sm text-muted-foreground">
                  Notify municipal admin of decline reason
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setDeclineModalOpen(false)
                  }}
                  className="px-4 py-2 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecline}
                  disabled={!declineReason || (declineReason === 'Custom reason' && !customReason)}
                  className="px-4 py-2 rounded-md bg-red-50 text-red-700 border border-red-200 text-body-sm font-medium hover:bg-red-100 transition-all disabled:opacity-40"
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {forwardConfirmOpen && selectedEsc && (
          <Modal
            onClose={() => {
              setForwardConfirmOpen(false)
              setForwardStep(1)
            }}
            title="Forward to NDRRMC"
            maxWidth="520px"
          >
            <div className="space-y-4">
              {successState ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <CheckCircle className="w-16 h-16 text-green-700 mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold text-green-700 mb-2">
                    Escalation Forwarded
                  </h3>
                  <p className="text-body-md text-foreground mb-1">
                    {selectedEsc.id} has been forwarded to NDRRMC
                  </p>
                  <p className="text-sm font-mono text-accent mb-1">Ref: {successState.ref}</p>
                  <p className="text-xs text-muted-foreground/70 mb-4">
                    via {FORWARD_METHODS.find((m) => m.id === successState.method)?.label}
                  </p>
                  <button
                    onClick={() => {
                      setSuccessState(null)
                      setForwardConfirmOpen(false)
                      setForwardStep(1)
                      setSelectedEsc(null)
                    }}
                    className="px-6 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
                  >
                    Done
                  </button>
                </motion.div>
              ) : (
                <>
                  {forwardStep === 1 ? (
                    <>
                      <div className="bg-muted border border-border rounded-lg p-4">
                        <p className="text-body-sm text-muted-foreground mb-3">
                          You are about to forward:
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-body-sm">
                            <span className="text-muted-foreground">Escalation</span>
                            <span className="text-foreground font-mono">{selectedEsc.id}</span>
                          </div>
                          <div className="flex justify-between text-body-sm">
                            <span className="text-muted-foreground">Municipality</span>
                            <span className="text-foreground">{selectedEsc.municipality}</span>
                          </div>
                          <div className="flex justify-between text-body-sm">
                            <span className="text-muted-foreground">Method</span>
                            <span className="text-foreground">
                              {FORWARD_METHODS.find((m) => m.id === forwardMethod)?.label}
                            </span>
                          </div>
                          <div className="flex justify-between text-body-sm">
                            <span className="text-muted-foreground">Recipients Est.</span>
                            <span className="text-foreground font-mono">~2,847 users</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-body-sm text-red-700">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          This action is irreversible and will be permanently logged.
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                        <button
                          onClick={() => {
                            setForwardConfirmOpen(false)
                            setForwardStep(1)
                          }}
                          className="px-4 py-2 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            setForwardStep(2)
                          }}
                          className="px-4 py-2 rounded-md bg-purple-700 text-white text-body-sm font-medium hover:bg-purple-800 transition-all"
                        >
                          Continue &rarr;
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-lg font-semibold text-red-700 mb-1">
                          Final Confirmation
                        </p>
                        <p className="text-body-sm text-red-700">
                          Confirm that you have authority to escalate this incident to NDRRMC on
                          behalf of Camarines Norte PDRRMO.
                        </p>
                      </div>
                      <div className="bg-muted border border-border rounded-lg p-4">
                        <p className="text-body-sm text-muted-foreground mb-2">
                          Escalation summary:
                        </p>
                        <p className="text-xs text-muted-foreground/70 font-mono whitespace-pre-line">
                          {messageDraft.slice(0, 200)}...
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                        <button
                          onClick={() => {
                            setForwardStep(1)
                          }}
                          className="px-4 py-2 rounded-md text-body-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          &larr; Go Back
                        </button>
                        <button
                          onClick={handleForward}
                          disabled={processing}
                          className="flex items-center gap-2 px-5 py-2 rounded-md bg-purple-700 text-white text-body-sm font-medium hover:bg-purple-800 transition-all disabled:opacity-60"
                        >
                          {processing ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Confirm Forward
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </AppShell>
  )
}

function Modal({
  children,
  onClose,
  title,
  maxWidth = '560px',
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative bg-white border border-border rounded-xl w-full mx-4 shadow-xl overflow-hidden"
        style={{ maxWidth }}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  )
}
