/**
 * UpdateTimeline Component
 *
 * Displays a vertical timeline of report status updates.
 */

import {
  FileText,
  CheckCircle,
  Truck,
  MapPin,
  MessageSquare,
  Clock,
} from 'lucide-react'
import { formatTimeAgo } from '@/shared/utils/formatTimeAgo'

export interface TimelineEntry {
  id: string
  timestamp: Date
  type: 'submitted' | 'verified' | 'dispatched' | 'acknowledged' | 'resolved' | 'update' | 'comment'
  description: string
  actor?: string
}

export interface UpdateTimelineProps {
  entries: TimelineEntry[]
}

const TIMELINE_ICONS: Record<TimelineEntry['type'], React.ElementType> = {
  submitted: FileText,
  verified: CheckCircle,
  dispatched: Truck,
  acknowledged: MapPin,
  resolved: CheckCircle,
  update: MessageSquare,
  comment: MessageSquare,
}

const TIMELINE_COLORS: Record<TimelineEntry['type'], string> = {
  submitted: 'bg-blue-500',
  verified: 'bg-green-500',
  dispatched: 'bg-orange-500',
  acknowledged: 'bg-purple-500',
  resolved: 'bg-green-600',
  update: 'bg-gray-500',
  comment: 'bg-gray-400',
}

export function UpdateTimeline({ entries }: UpdateTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No updates yet</p>
        <p className="text-sm text-gray-400">
          Updates will appear here as your report is processed
        </p>
      </div>
    )
  }

  return (
    <div className="relative" data-testid="update-timeline">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {entries.map((entry, index) => {
          const Icon = TIMELINE_ICONS[entry.type]
          const colorClass = TIMELINE_COLORS[entry.type]
          const isLast = index === entries.length - 1

          return (
            <div
              key={entry.id}
              className="relative flex gap-3"
              data-testid={`timeline-item-${entry.id}`}
            >
              {/* Icon circle */}
              <div
                className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${colorClass} flex items-center justify-center`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="font-medium text-gray-900 text-sm">
                    {entry.description}
                  </p>
                  {isLast && (
                    <span className="text-xs text-primary-blue font-medium">
                      Latest
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatTimeAgo(entry.timestamp.getTime())}</span>
                  {entry.actor && (
                    <>
                      <span>•</span>
                      <span>{entry.actor}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
