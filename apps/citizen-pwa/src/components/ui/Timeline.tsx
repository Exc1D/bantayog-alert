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
    <div className="relative pl-3">
      <div className="absolute left-[3px] top-2 bottom-2 w-0.5 bg-[#e5e7eb]" />
      {events.map((event, i) => (
        <div key={i} className="relative pb-3.5">
          <div
            className={`absolute -left-[12px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
              event.state === 'complete'
                ? 'bg-[#16a34a]'
                : event.state === 'queued'
                  ? 'bg-[#f59e0b]'
                  : event.state === 'failed'
                    ? 'bg-[#dc2626]'
                    : 'bg-[#d1d5db]'
            }`}
          />
          <div className="text-sm font-medium text-[#1d1d1f]">{event.label}</div>
          <div className="text-[11px] text-[#7b8794]">{event.meta}</div>
        </div>
      ))}
    </div>
  )
}
