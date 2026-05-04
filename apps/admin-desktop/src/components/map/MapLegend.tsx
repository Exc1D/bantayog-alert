import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function MapLegend() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="absolute bottom-6 right-6 z-[500] bg-white border border-border rounded-lg shadow-lg max-w-[200px] overflow-hidden">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls="map-legend-content"
        onClick={() => {
          setCollapsed(!collapsed)
        }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors"
      >
        <span className="text-lg font-semibold text-foreground">Legend</span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground/70" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground/70" />
        )}
      </button>

      {!collapsed && (
        <div id="map-legend-content" className="px-4 pb-4 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Incident Severity
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <svg width="12" height="16" viewBox="0 0 28 36">
                  <path
                    d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
                    fill="#dc2626"
                  />
                </svg>
                <span className="text-xs text-foreground">High Severity</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="12" height="16" viewBox="0 0 28 36">
                  <path
                    d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
                    fill="#d97706"
                  />
                </svg>
                <span className="text-xs text-foreground">Medium Severity</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="12" height="16" viewBox="0 0 28 36">
                  <path
                    d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
                    fill="#16a34a"
                  />
                </svg>
                <span className="text-xs text-foreground">Low Severity</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Responders
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-accent border-2 border-white" />
                <span className="text-xs text-foreground">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border border-accent border-dashed" />
                <span className="text-xs text-foreground">En route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-accent border-2 border-white" />
                <span className="text-xs text-foreground">On scene</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Heatmap
            </div>
            <div
              className="h-2 rounded-full w-full"
              style={{
                background: 'linear-gradient(to right, #dbeafe, #93c5fd, #fbbf24, #fca5a5)',
              }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground/70">Low</span>
              <span className="text-xs text-muted-foreground/70">Critical</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
