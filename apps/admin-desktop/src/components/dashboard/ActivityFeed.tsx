import { CheckCircle, XCircle, AlertCircle, ArrowUpRight, User, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportEventWithId } from '@/hooks/useReportEvents'

export type { ReportEventWithId }

interface ActivityFeedProps {
  events: ReportEventWithId[]
  loading?: boolean
  error?: string | null
  maxVisible?: number
}

function getEventIconAndColor(event: ReportEventWithId): { icon: React.ReactNode; color: string } {
  const to = event.toStatus

  if (to === 'verified' || to === 'resolved' || to === 'closed') {
    return {
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'text-green-700',
    }
  }

  if (to === 'rejected' || to === 'cancelled' || to === 'cancelled_false_report') {
    return {
      icon: <XCircle className="w-4 h-4" />,
      color: 'text-red-700',
    }
  }

  if (to === 'assigned' || to === 'acknowledged' || to === 'en_route' || to === 'on_scene') {
    return {
      icon: <ArrowUpRight className="w-4 h-4" />,
      color: 'text-amber-700',
    }
  }

  if (event.actorRole === 'system') {
    return {
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'text-muted-foreground/70',
    }
  }

  return {
    icon: <User className="w-4 h-4" />,
    color: 'text-blue-700',
  }
}

function formatEventDescription(event: ReportEventWithId): string {
  const statusLabels: Record<string, string> = {
    draft_inbox: 'Draft',
    new: 'Submitted',
    awaiting_verify: 'Awaiting Verification',
    verified: 'Verified',
    assigned: 'Assigned',
    acknowledged: 'Acknowledged',
    en_route: 'En Route',
    on_scene: 'On Scene',
    resolved: 'Resolved',
    closed: 'Closed',
    reopened: 'Reopened',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    cancelled_false_report: 'Cancelled (False Report)',
    merged_as_duplicate: 'Merged as Duplicate',
  }

  const fromLabel = statusLabels[event.fromStatus] ?? event.fromStatus
  const toLabel = statusLabels[event.toStatus] ?? event.toStatus

  if (event.toStatus === 'verified') {
    return `verified report`
  }
  if (event.toStatus === 'rejected') {
    return `rejected report${event.reason ? `: ${event.reason}` : ''}`
  }
  if (event.toStatus === 'resolved') {
    return `resolved report`
  }
  if (event.toStatus === 'closed') {
    return `closed report`
  }
  if (event.toStatus === 'cancelled' || event.toStatus === 'cancelled_false_report') {
    return `cancelled report`
  }

  return `changed status from ${fromLabel} to ${toLabel}`
}

export function ActivityFeed({
  events,
  loading = false,
  error = null,
  maxVisible = 20,
}: ActivityFeedProps) {
  if (error) {
    return (
      <div className="h-[80px] flex flex-col items-center justify-center gap-2 text-sm text-red-700">
        <AlertCircle className="w-5 h-5" />
        <span>Failed to load activity feed</span>
        <span className="text-xs text-muted-foreground/70">{error}</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-[80px] flex items-center justify-center text-sm text-muted-foreground/70">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        Loading activity feed...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="h-[80px] flex items-center justify-center text-sm text-muted-foreground/70">
        No activity yet. Events will appear here as reports are processed.
      </div>
    )
  }

  const visibleEvents = events.slice(0, maxVisible)

  return (
    <div className="space-y-3">
      {visibleEvents.map((event) => {
        const { icon, color } = getEventIconAndColor(event)
        const timestamp = new Date(event.createdAt * 1000)
        const hours = String(timestamp.getHours()).padStart(2, '0')
        const minutes = String(timestamp.getMinutes()).padStart(2, '0')
        const seconds = String(timestamp.getSeconds()).padStart(2, '0')

        return (
          <div
            key={event.id}
            className="flex items-start gap-3 py-2 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-2 w-[80px] shrink-0">
              <span className="text-xs font-mono text-muted-foreground/70">
                {hours}:{minutes}:{seconds}
              </span>
            </div>
            <div className={cn('shrink-0 mt-0.5', color)}>{icon}</div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-muted-foreground">{event.actor}</span>
              <span className="text-sm text-foreground ml-1">{formatEventDescription(event)}</span>
              <span className="text-xs font-mono text-accent ml-1">
                #{event.reportId.slice(0, 8)}
              </span>
            </div>
            {event.municipalityId && (
              <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full shrink-0">
                {event.municipalityId}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
