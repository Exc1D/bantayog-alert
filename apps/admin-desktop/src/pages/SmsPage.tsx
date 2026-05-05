import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useSmsAudit } from '@/hooks/useSmsAudit'
import { MessageSquare, RefreshCw, AlertCircle, Search } from 'lucide-react'

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

function StatusBadge({ value, variants }: { value: string; variants: Record<string, string> }) {
  const cls = variants[value] ?? 'bg-gray-50 text-gray-500 border-gray-200'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {value}
    </span>
  )
}

const outboxStatusVariants: Record<string, string> = {
  queued: 'bg-amber-50 text-amber-800 border-amber-200',
  sending: 'bg-blue-50 text-blue-800 border-blue-200',
  sent: 'bg-green-50 text-green-800 border-green-200',
  delivered: 'bg-green-50 text-green-800 border-green-200',
  failed: 'bg-red-50 text-red-800 border-red-200',
  deferred: 'bg-gray-50 text-gray-700 border-gray-200',
  abandoned: 'bg-gray-50 text-gray-500 border-gray-200',
}

const parseStatusVariants: Record<string, string> = {
  parsed: 'bg-green-50 text-green-800 border-green-200',
  low_confidence: 'bg-amber-50 text-amber-800 border-amber-200',
  unparseable: 'bg-red-50 text-red-800 border-red-200',
  pending: 'bg-gray-50 text-gray-500 border-gray-200',
  pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
}

const circuitStateVariants: Record<string, string> = {
  closed: 'bg-green-50 text-green-800 border-green-200',
  open: 'bg-red-50 text-red-800 border-red-200',
  half_open: 'bg-amber-50 text-amber-800 border-amber-200',
}

function hashPreview(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`
}

export default function SmsPage() {
  const [activeTab, setActiveTab] = useState<'outbox' | 'inbox' | 'health'>('outbox')
  const [searchQuery, setSearchQuery] = useState('')
  const { outbox, inbox, providerHealth, loading, error } = useSmsAudit()

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredOutbox = normalizedQuery
    ? outbox.filter(
        (msg) =>
          msg.purpose.toLowerCase().includes(normalizedQuery) ||
          msg.status.toLowerCase().includes(normalizedQuery) ||
          msg.recipientMsisdnHash.toLowerCase().includes(normalizedQuery),
      )
    : outbox

  const filteredInbox = normalizedQuery
    ? inbox.filter(
        (msg) =>
          msg.body.toLowerCase().includes(normalizedQuery) ||
          msg.parseStatus.toLowerCase().includes(normalizedQuery) ||
          msg.senderMsisdnHash.toLowerCase().includes(normalizedQuery),
      )
    : inbox

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
          <span>Loading SMS data...</span>
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2 text-red-700">
          <AlertCircle className="w-6 h-6" />
          <span>Failed to load SMS data</span>
          <span className="text-sm text-muted-foreground">{error}</span>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare className="w-6 h-6" />
          <h1 className="text-2xl font-semibold">SMS Audit</h1>
        </div>

        <div role="tablist" className="flex gap-1 mb-6 border-b border-border">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'outbox'}
            onClick={() => {
              setActiveTab('outbox')
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'outbox'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Outbox
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inbox'}
            onClick={() => {
              setActiveTab('inbox')
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'inbox'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Inbox
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'health'}
            onClick={() => {
              setActiveTab('health')
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'health'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Provider Health
          </button>
        </div>

        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
              }}
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {activeTab === 'outbox' && (
          <div>
            {filteredOutbox.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {normalizedQuery ? 'No matching outbox messages.' : 'No outbox messages yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 px-3 font-medium">Recipient Hash</th>
                      <th className="py-2 px-3 font-medium">Purpose</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-3 font-medium">Segments</th>
                      <th className="py-2 px-3 font-medium">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOutbox.map((msg) => (
                      <tr key={msg.id} className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-xs">
                          {hashPreview(msg.recipientMsisdnHash)}
                        </td>
                        <td className="py-2 px-3">{msg.purpose}</td>
                        <td className="py-2 px-3">
                          <StatusBadge value={msg.status} variants={outboxStatusVariants} />
                        </td>
                        <td className="py-2 px-3">{msg.predictedSegmentCount}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {formatTimestamp(msg.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'inbox' && (
          <div>
            {filteredInbox.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {normalizedQuery ? 'No matching inbox messages.' : 'No inbox messages yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 px-3 font-medium">Sender Hash</th>
                      <th className="py-2 px-3 font-medium">Body</th>
                      <th className="py-2 px-3 font-medium">Parse Status</th>
                      <th className="py-2 px-3 font-medium">Confidence</th>
                      <th className="py-2 px-3 font-medium">Parsed Into</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInbox.map((msg) => (
                      <tr key={msg.id} className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-xs">
                          {hashPreview(msg.senderMsisdnHash)}
                        </td>
                        <td className="py-2 px-3 max-w-xs truncate" title={msg.body}>
                          {msg.body}
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge value={msg.parseStatus} variants={parseStatusVariants} />
                        </td>
                        <td className="py-2 px-3">
                          {msg.confidenceScore !== undefined
                            ? `${String(Math.round(msg.confidenceScore * 100))}%`
                            : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">
                          {msg.parsedIntoInboxId ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'health' && (
          <div>
            {providerHealth.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No provider health data yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providerHealth.map((h) => (
                  <div key={h.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold capitalize">{h.providerId}</h3>
                      <StatusBadge value={h.circuitState} variants={circuitStateVariants} />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Error Rate</span>
                        <span className="font-mono">{h.errorRatePct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Transition</span>
                        <span>{h.lastTransitionReason ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Probe</span>
                        <span className="text-muted-foreground">
                          {h.lastProbeAt ? formatTimestamp(h.lastProbeAt) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
