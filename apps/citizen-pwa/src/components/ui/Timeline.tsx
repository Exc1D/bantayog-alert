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
          <div className="flex items-center w-full">
            <div className="relative">
              <div className={`timeline-dot timeline-dot--${event.state}`} aria-hidden="true" />
            </div>
            {i < events.length - 1 && (
              <div
                className={`timeline-connector timeline-connector--${event.state}`}
                style={{ marginTop: '-5px' }}
              />
            )}
          </div>
          <div className="timeline-label">{event.label}</div>
          {event.meta && <div className="timeline-meta">{event.meta}</div>}
          <span className="sr-only">{event.state} status</span>
        </div>
      ))}
    </div>
  )
}
