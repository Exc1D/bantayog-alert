import { Layers } from 'lucide-react'

interface MapLayerTogglesProps {
  layers: {
    incidents: boolean
    responders: boolean
    resources: boolean
    boundaries: boolean
    heatmap: boolean
    labels: boolean
  }
  onToggle: (key: string) => void
}

const layerConfig = [
  { key: 'incidents', label: 'Incident Pins', defaultOn: true },
  { key: 'responders', label: 'Responder Locations', defaultOn: true },
  { key: 'resources', label: 'Resource Pins', defaultOn: false },
  { key: 'boundaries', label: 'Municipal Boundaries', defaultOn: true },
  { key: 'heatmap', label: 'Incident Density Heatmap', defaultOn: false },
  { key: 'labels', label: 'Municipality Labels', defaultOn: true },
]

export function MapLayerToggles({ layers, onToggle }: MapLayerTogglesProps) {
  return (
    <div className="absolute top-6 right-6 z-[500] bg-white border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-foreground font-medium">Layers</span>
      </div>
      <div className="space-y-2">
        {layerConfig.map((layer) => {
          const checked = layers[layer.key as keyof typeof layers]
          return (
            <label key={layer.key} className="flex items-center gap-2 cursor-pointer group">
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  checked
                    ? 'bg-accent border-accent'
                    : 'bg-transparent border-border group-hover:border-foreground/20'
                }`}
              >
                {checked && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  onToggle(layer.key)
                }}
                className="sr-only"
              />
              <span
                className={`text-xs ${checked ? 'text-foreground' : 'text-muted-foreground/70'} transition-colors`}
              >
                {layer.label}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
