import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import type { Responder } from '../types'

const RESPONDER_COLOR = '#3b82f6'

function createDotIcon() {
  const html = `<div style="
    width: 12px;
    height: 12px;
    background-color: ${RESPONDER_COLOR};
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  "></div>`
  return L.divIcon({
    html,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

interface Props {
  responders: Responder[]
}

export function ResponderLayer({ responders }: Props) {
  const map = useMap()
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []

    responders.forEach((responder) => {
      if (responder.latitude == null || responder.longitude == null) return

      const marker = L.marker([responder.latitude, responder.longitude], {
        icon: createDotIcon(),
      })
      marker.bindTooltip(`${responder.name} — ${responder.agency}`, {
        direction: 'top',
        offset: [0, -8],
      })
      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }, [responders, map])

  return null
}
