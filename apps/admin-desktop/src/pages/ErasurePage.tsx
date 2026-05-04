import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  ShieldAlert,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Search,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { AppShell } from '@/components/layout/AppShell'
import { cn } from '@/lib/utils'
import type { DataErasureRequest } from '@/types'

function ErasureStatusBadge({ status, className }: { status: string; className?: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    DECLINED: 'bg-red-50 text-red-700 border-red-200',
    IN_PROGRESS: 'bg-accent/10 text-accent border-accent/30',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        map[status] ?? map.PENDING,
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-body-sm text-foreground">{value}</div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-body-sm text-foreground text-right">{value}</span>
    </div>
  )
}

export default function ErasurePage() {
  const { erasureRequests } = useDataStore()
  const { addToast } = useUIStore()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<DataErasureRequest | null>(null)
  const [approveReason, setApproveReason] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [, setProcessingStep] = useState(0)
  const [localRequests, setLocalRequests] = useState<DataErasureRequest[]>([...erasureRequests])

  const filtered = useMemo(() => {
    return localRequests
      .filter((req) => {
        if (statusFilter !== 'all' && req.status !== statusFilter) return false
        if (search) {
          const q = search.toLowerCase()
          const hay = `${req.id} ${req.requesterName} ${req.requesterEmail}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => +parseISO(b.createdAt) - +parseISO(a.createdAt))
  }, [localRequests, statusFilter, search])

  const stats = useMemo(() => {
    const pending = localRequests.filter((r) => r.status === 'PENDING').length
    const approved = localRequests.filter(
      (r) => r.status === 'APPROVED' || r.status === 'IN_PROGRESS',
    ).length
    const declined = localRequests.filter((r) => r.status === 'DECLINED').length
    return { pending, approved, declined }
  }, [localRequests])

  const handleApprove = useCallback(
    (req: DataErasureRequest) => {
      if (!approveReason.trim()) {
        addToast({
          title: 'Reason Required',
          message: 'Please provide a documented reason for approval.',
          type: 'error',
        })
        return
      }
      setProcessingId(req.id)
      setProcessingStep(0)
      const steps = [1, 2, 3, 4]
      let idx = 0
      const interval = setInterval(() => {
        idx += 1
        setProcessingStep(idx)
        if (idx >= steps.length) {
          clearInterval(interval)
          setLocalRequests((prev) =>
            prev.map((r) => (r.id === req.id ? { ...r, status: 'IN_PROGRESS' } : r)),
          )
          setProcessingId(null)
          addToast({
            title: 'Erasure Approved',
            message: `Request ${req.id} approved. Processing started.`,
            type: 'success',
          })
          setApproveReason('')
        }
      }, 800)
    },
    [addToast, approveReason],
  )

  const handleDecline = useCallback(
    (req: DataErasureRequest) => {
      if (!declineReason.trim()) {
        addToast({
          title: 'Reason Required',
          message: 'RA 10173 requires a documented reason for decline.',
          type: 'error',
        })
        return
      }
      setLocalRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: 'DECLINED' } : r)),
      )
      setShowDeclineModal(false)
      setDeclineReason('')
      addToast({
        title: 'Request Declined',
        message: `Erasure request ${req.id} declined with reason.`,
        type: 'warning',
      })
    },
    [addToast, declineReason],
  )

  const selectRequest = useCallback((req: DataErasureRequest) => {
    setSelected(req)
    setApproveReason('')
    setDeclineReason('')
  }, [])

  return (
    <AppShell>
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Data Erasure Requests</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              RA 10173 compliance &mdash; review and process data subject requests
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-body-sm text-muted-foreground">
              {stats.pending} pending &middot; {stats.approved} approved &middot; {stats.declined}{' '}
              declined
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="w-3 h-3" /> RA 10173 Compliant
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <input
                  type="text"
                  placeholder="Search by ID, name, phone..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                  }}
                  className="w-full bg-white border border-border rounded-md pl-9 pr-4 py-2 text-body-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                }}
                className="bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
              >
                <option value="all">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="DECLINED">Declined</option>
                <option value="IN_PROGRESS">Processing</option>
              </select>
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {filtered.map((req) => {
                  const age = differenceInDays(new Date(), parseISO(req.createdAt))
                  const isOverdue = age > 7
                  const isSelected = selected?.id === req.id
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        selectRequest(req)
                      }}
                      className={cn(
                        'bg-white border rounded-lg p-4 cursor-pointer transition-all',
                        isSelected
                          ? 'border-accent border-l-4'
                          : 'border-border hover:border-muted-foreground/30',
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-mono-sm text-accent">
                            #{req.id.toUpperCase()}
                          </span>
                          <ErasureStatusBadge status={req.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          {isOverdue && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                              OVERDUE
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground/70">{age}d old</span>
                        </div>
                      </div>
                      <div className="text-body-sm text-foreground font-medium">
                        {req.requesterName}
                      </div>
                      <div className="text-xs text-muted-foreground">{req.requesterEmail}</div>
                      <div className="text-xs text-muted-foreground/70 mt-1">
                        {format(parseISO(req.createdAt), 'MMM d, yyyy')}
                      </div>
                      <div className="text-body-sm text-muted-foreground italic mt-2 truncate">
                        &ldquo;{req.reason}&rdquo;
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-accent text-xs hover:underline">
                        Review <ChevronRight className="w-3 h-3" />
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              {filtered.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-700 mx-auto mb-3" />
                  <p className="text-body-md text-muted-foreground">No pending erasure requests</p>
                  <p className="text-body-sm text-muted-foreground/70">
                    All data subject requests have been processed.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            {selected ? (
              <div className="space-y-4">
                <div className="bg-white border border-border rounded-lg p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-mono text-body-md text-accent">
                        #{selected.id.toUpperCase()}
                      </div>
                      <ErasureStatusBadge status={selected.status} className="mt-1" />
                    </div>
                    <div
                      className={cn(
                        'text-body-md',
                        selected.status === 'PENDING' ? 'text-amber-700' : 'text-green-700',
                      )}
                    >
                      {selected.status === 'PENDING'
                        ? `Pending ${String(differenceInDays(new Date(), parseISO(selected.createdAt)))} days`
                        : selected.status}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-border rounded-lg p-5">
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                    <span className="text-xs text-red-700">
                      Private citizen data &mdash; access logged
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Requester Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoRow
                      icon={<User className="w-4 h-4" />}
                      label="Name"
                      value={selected.requesterName}
                    />
                    <InfoRow
                      icon={<Mail className="w-4 h-4" />}
                      label="Email"
                      value={selected.requesterEmail}
                    />
                    <InfoRow
                      icon={<Phone className="w-4 h-4" />}
                      label="Phone"
                      value="+63 9XX XXX XXXX"
                    />
                    <InfoRow
                      icon={<MapPin className="w-4 h-4" />}
                      label="Address"
                      value="Camarines Norte, Philippines"
                    />
                    <InfoRow
                      icon={<Shield className="w-4 h-4" />}
                      label="ID Verified"
                      value={
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle className="w-3 h-3" /> Yes (via OTP)
                        </span>
                      }
                    />
                    <InfoRow
                      icon={<Clock className="w-4 h-4" />}
                      label="Account Created"
                      value="Jan 10, 2023"
                    />
                  </div>
                </div>

                <div className="bg-white border border-border rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-3">Request Details</h3>
                  <div className="space-y-2">
                    <DetailRow label="Request ID" value={`#${selected.id.toUpperCase()}`} />
                    <DetailRow
                      label="Submitted"
                      value={format(parseISO(selected.createdAt), 'MMM d, yyyy, HH:mm')}
                    />
                    <DetailRow label="Reason" value={selected.reason} />
                    <DetailRow label="Scope" value="All personal data" />
                    <DetailRow
                      label="Identity Verified"
                      value="Yes &mdash; OTP verified at submission"
                    />
                    <DetailRow label="Previous Requests" value="0 previous requests" />
                  </div>
                </div>

                <div className="bg-muted border border-border rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Data Impact Assessment
                  </h3>
                  <p className="text-xs text-muted-foreground/70 mb-4">
                    This assessment shows what data would be erased and what operational impact may
                    result.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <div className="text-body-sm text-red-700 font-medium mb-1">
                        Data to be Erased
                      </div>
                      <ul className="space-y-1 text-body-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <XCircle className="w-3 h-3 text-red-700" /> Personal information: Name,
                          phone, email, address &mdash;{' '}
                          <span className="text-foreground">4 fields</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <XCircle className="w-3 h-3 text-red-700" /> Report history:{' '}
                          <span className="text-foreground">
                            {selected.reportIds.length} incident reports
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <XCircle className="w-3 h-3 text-red-700" /> Messages in threads
                        </li>
                        <li className="flex items-center gap-2">
                          <XCircle className="w-3 h-3 text-red-700" /> Location data from reports
                        </li>
                      </ul>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="text-body-sm text-amber-700 font-medium mb-1">
                        Operational Impact
                      </div>
                      <ul className="space-y-1 text-body-sm text-muted-foreground">
                        <li>&bull; Citizen will no longer receive alerts</li>
                        <li>
                          &bull; Historical incident data will be{' '}
                          <strong className="text-foreground">anonymized</strong> (retained for
                          statistics, unlinked from identity)
                        </li>
                        <li>&bull; No active incidents currently linked</li>
                      </ul>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="text-body-sm text-green-700 font-medium mb-1">
                        Retention Exceptions
                      </div>
                      <ul className="space-y-1 text-body-sm text-muted-foreground">
                        <li>
                          &bull; Incident metadata retained for disaster response records
                          (anonymized)
                        </li>
                        <li>&bull; Audit logs mentioning this citizen retained for compliance</li>
                        <li>
                          &bull; Verified reports retained as anonymized public records &mdash;{' '}
                          <strong className="text-amber-700">cannot be erased</strong>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {selected.status === 'IN_PROGRESS' && (
                  <div className="bg-white border border-border rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      Processing Progress
                    </h3>
                    <div className="space-y-2">
                      {[
                        'Verify request',
                        'Anonymize incident reports',
                        'Erase personal data fields',
                        'Send confirmation to citizen',
                      ].map((step, i) => (
                        <div key={step} className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                              i < 3
                                ? 'bg-green-700 text-white'
                                : 'bg-muted text-muted-foreground/70',
                            )}
                          >
                            {i < 3 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                          </div>
                          <span
                            className={cn(
                              'text-body-sm',
                              i < 3 ? 'text-foreground' : 'text-muted-foreground/70',
                            )}
                          >
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full bg-green-700 rounded-full transition-all"
                        style={{ width: '75%' }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-2">~2 minutes remaining</p>
                  </div>
                )}

                {selected.status === 'PENDING' && (
                  <div className="bg-muted border-t border-border rounded-lg p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="text-lg font-semibold text-green-700">Approve Erasure</h4>
                        <textarea
                          value={approveReason}
                          onChange={(e) => {
                            setApproveReason(e.target.value)
                          }}
                          placeholder="Documented reason for approval (required)..."
                          className="w-full bg-white border border-border rounded-md p-3 text-body-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none min-h-[80px]"
                        />
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="accent-accent" />
                          <span className="text-xs text-muted-foreground">
                            I have verified the requester&apos;s identity and consent
                          </span>
                        </label>
                        <button
                          onClick={() => {
                            handleApprove(selected)
                          }}
                          disabled={processingId === selected.id}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-green-700 text-white hover:bg-green-800 transition-all text-body-sm font-medium disabled:opacity-40"
                        >
                          {processingId === selected.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" /> Approve Erasure
                            </>
                          )}
                        </button>
                        <p className="text-xs text-muted-foreground/70">
                          Data will be permanently erased within 24 hours
                        </p>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-lg font-semibold text-red-700">Decline with Reason</h4>
                        <p className="text-xs text-muted-foreground/70">
                          Requires documented reason per RA 10173
                        </p>
                        <button
                          onClick={() => {
                            setShowDeclineModal(true)
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all text-body-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" /> Decline with Reason
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-border rounded-lg p-10 text-center h-full flex flex-col items-center justify-center">
                <Shield className="w-16 h-16 text-muted-foreground/70 mb-4" />
                <p className="text-body-md text-muted-foreground">Select a request to review</p>
                <p className="text-body-sm text-muted-foreground/70 mt-2">
                  RA 10173 compliance review panel
                </p>
              </div>
            )}
          </div>
        </div>

        {showDeclineModal && selected && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowDeclineModal(false)
              }}
              onClick={() => {
                setShowDeclineModal(false)
              }}
            />
            <div className="relative bg-white border border-border rounded-xl max-w-[560px] w-full mx-4 p-5">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Decline Erasure Request
              </h3>
              <p className="text-body-sm text-muted-foreground mb-4">
                RA 10173 Section 16 &mdash; Right to Erasure exceptions
              </p>
              <div className="space-y-3 mb-4">
                <span className="block text-xs text-muted-foreground mb-1">Reason</span>
                <select
                  value={declineReason}
                  onChange={(e) => {
                    setDeclineReason(e.target.value)
                  }}
                  className="w-full bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none mb-2"
                >
                  <option value="">Select a reason...</option>
                  <option value="Identity verification failed">Identity verification failed</option>
                  <option value="Request not from data subject">
                    Request not from data subject
                  </option>
                  <option value="Data required for ongoing legal/response proceedings">
                    Data required for ongoing legal/response proceedings
                  </option>
                  <option value="Request is frivolous or vexatious">
                    Request is frivolous or vexatious
                  </option>
                  <option value="Custom reason">Custom reason</option>
                </select>
                <textarea
                  value={declineReason}
                  onChange={(e) => {
                    setDeclineReason(e.target.value)
                  }}
                  placeholder="Detailed reason..."
                  className="w-full bg-white border border-border rounded-md p-3 text-body-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none min-h-[80px]"
                />
              </div>
              <label className="flex items-center gap-2 mb-6 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-accent" />
                <span className="text-xs text-muted-foreground">Send reason to citizen</span>
              </label>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeclineModal(false)
                  }}
                  className="px-4 py-2 rounded-md border border-border text-body-sm text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleDecline(selected)
                  }}
                  className="px-4 py-2 rounded-md bg-red-50 text-red-700 border border-red-200 text-body-sm font-medium hover:bg-red-100 transition-all"
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
