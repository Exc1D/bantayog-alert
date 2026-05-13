import React from 'react'

interface TimelineProps {
  events: {
    label: string
    meta: string
    state: 'complete' | 'pending' | 'queued' | 'failed'
  }[]
}

export function Timeline({ events }: TimelineProps) {
  return (
    <div className="timeline">
      {events.map((event, i) => (
        <div key={i} className="timeline-item">
          <div className="timeline-line-row">
            <div className={`timeline-line timeline-line--${event.state}`} aria-hidden="true" />
          </div>
          <div className="timeline-label">{event.label}</div>
          {event.meta && <div className="timeline-meta">{event.meta}</div>}
          <span className="sr-only">{event.state} status</span>
        </div>
      ))}
    </div>
  )
}
