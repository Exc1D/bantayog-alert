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
      <div className="timeline-track" />
      {events.map((event, i) => (
        <div key={i} className="timeline-item">
          <div className={`timeline-dot timeline-dot--${event.state}`} aria-hidden="true" />
          <div className="timeline-label">{event.label}</div>
          <div className="timeline-meta">{event.meta}</div>
          <span className="sr-only">{event.state} status</span>
        </div>
      ))}
    </div>
  )
}
