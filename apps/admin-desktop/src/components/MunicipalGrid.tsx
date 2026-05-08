import { useState, useRef, useEffect } from 'react'
import { MunicipalCard } from './MunicipalCard'

export interface MunicipalityData {
  name: string
  activeIncidents: number
  avgResponseTimeMinutes: number | null
  status: 'responsive' | 'slow' | 'delayed'
}

interface MunicipalGridProps {
  municipalities: MunicipalityData[]
  onMunicipalityClick: (name: string) => void
}

type SortOption = 'alphabetical' | 'responseTime' | 'activeCount'

const statusSeverity: Record<MunicipalityData['status'], number> = {
  responsive: 0,
  slow: 1,
  delayed: 2,
}

export function MunicipalGrid({ municipalities, onMunicipalityClick }: MunicipalGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical')
  const prevStatusesRef = useRef<Record<string, MunicipalityData['status']>>({})
  const [animatingCards, setAnimatingCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    const newAnimating = new Set<string>()
    municipalities.forEach((m) => {
      const prevStatus = prevStatusesRef.current[m.name]
      if (prevStatus && statusSeverity[m.status] > statusSeverity[prevStatus]) {
        newAnimating.add(m.name)
      }
      prevStatusesRef.current[m.name] = m.status
    })

    if (newAnimating.size > 0) {
      setAnimatingCards(newAnimating)
      const timer = setTimeout(() => {
        setAnimatingCards(new Set())
      }, 2000)
      return () => {
        clearTimeout(timer)
      }
    }
    return undefined
  }, [municipalities])

  const sortedMunicipalities = [...municipalities].sort((a, b) => {
    switch (sortBy) {
      case 'responseTime': {
        const aTime = a.avgResponseTimeMinutes ?? Infinity
        const bTime = b.avgResponseTimeMinutes ?? Infinity
        return bTime - aTime
      }
      case 'activeCount':
        return b.activeIncidents - a.activeIncidents
      case 'alphabetical':
      default:
        return a.name.localeCompare(b.name)
    }
  })

  const totalActiveIncidents = sortedMunicipalities.reduce((sum, m) => sum + m.activeIncidents, 0)

  return (
    <div style={{ padding: '16px', height: '100%', overflow: 'auto', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ fontSize: '28px', fontWeight: 600, margin: 0, color: '#1a1a2e' }}>
          Municipal Status
        </h2>
        <select
          role="combobox"
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as SortOption)
          }}
          style={{
            fontSize: '18px',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #dee2e6',
          }}
        >
          <option value="alphabetical">Alphabetical</option>
          <option value="responseTime">Response Time</option>
          <option value="activeCount">Active Count</option>
        </select>
      </div>

      {totalActiveIncidents === 0 && (
        <div
          data-testid="municipal-grid-empty-state"
          style={{
            position: 'absolute',
            top: '80px',
            left: '16px',
            right: '16px',
            bottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(248, 249, 250, 0.9)',
            borderRadius: '8px',
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#2d6a4f',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                margin: '0 auto 16px auto',
              }}
            >
              &#10003;
            </div>
            <h3
              style={{ fontSize: '24px', fontWeight: 600, color: '#495057', margin: '0 0 8px 0' }}
            >
              All Clear
            </h3>
            <p style={{ fontSize: '16px', color: '#6c757d', margin: 0 }}>
              All municipalities reporting normal status
            </p>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
        }}
      >
        {sortedMunicipalities.map((municipality) => (
          <MunicipalCard
            key={municipality.name}
            municipality={municipality}
            onClick={() => {
              onMunicipalityClick(municipality.name)
            }}
            isAnimating={animatingCards.has(municipality.name)}
          />
        ))}
      </div>
    </div>
  )
}
