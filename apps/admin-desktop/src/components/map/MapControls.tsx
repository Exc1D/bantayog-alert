import { Plus, Minus, Home, Crosshair, Maximize, Minimize } from 'lucide-react'
import { useMap } from 'react-leaflet'
import { useCallback, useState } from 'react'

function onFullscreenError() {
  void 0
}

export function MapControls() {
  const map = useMap()
  const [isFullscreen, setIsFullscreen] = useState(false)

  const zoomIn = useCallback(() => {
    map.zoomIn()
  }, [map])
  const zoomOut = useCallback(() => {
    map.zoomOut()
  }, [map])
  const resetView = useCallback(() => {
    map.setView([14.12, 122.85], 10, { animate: true, duration: 0.5 })
  }, [map])
  const myLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      resetView()
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 14, { animate: true })
      },
      () => {
        resetView()
      },
    )
  }, [map, resetView])
  const toggleFullscreen = useCallback(() => {
    const el = map.getContainer()
    if (!document.fullscreenElement) {
      void el
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true)
        })
        .catch(onFullscreenError)
    } else {
      void document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false)
        })
        .catch(onFullscreenError)
    }
  }, [map])

  const btnClass =
    'w-9 h-9 flex items-center justify-center bg-white border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-sm'

  return (
    <div className="absolute bottom-6 left-6 z-[500] flex flex-col gap-2">
      <button onClick={zoomIn} className={btnClass} aria-label="Zoom in">
        <Plus className="w-4 h-4" />
      </button>
      <button onClick={zoomOut} className={btnClass} aria-label="Zoom out">
        <Minus className="w-4 h-4" />
      </button>
      <div className="h-px bg-border w-full" />
      <button onClick={resetView} className={btnClass} aria-label="Reset view">
        <Home className="w-4 h-4" />
      </button>
      <button onClick={myLocation} className={btnClass} aria-label="My location">
        <Crosshair className="w-4 h-4" />
      </button>
      <button onClick={toggleFullscreen} className={btnClass} aria-label="Toggle fullscreen">
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>
    </div>
  )
}
