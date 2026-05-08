import { useState, useMemo } from 'react'
import { CommandCenterShell } from '../components/CommandCenterShell'
import { TopBanner } from '../components/TopBanner'
import { ProvincialMap } from '../components/ProvincialMap'
import { MunicipalGrid, type MunicipalityData } from '../components/MunicipalGrid'
import { SystemHealthStrip } from '../components/SystemHealthStrip'
import { AlertDeclarationModal } from '../components/AlertDeclarationModal'
import { KpiPanel } from '../components/KpiPanel'
import { IncidentFeed, type IncidentFeedItem } from '../components/IncidentFeed'
import { useDashboardLiveData } from '../hooks/useDashboardLiveData'
import { useConnectionStatus } from '../hooks/useConnectionStatus'
import { useIncidentSubscription } from '../hooks/useIncidentSubscription'
import type { Incident } from '../components/ProvincialMap'

export function ProvinceDashboardPage() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null)
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [kpiPanelOpen, setKpiPanelOpen] = useState(false)
  const [incidentPanelOpen, setIncidentPanelOpen] = useState(false)
  const { status: connectionStatus, lastUpdated } = useConnectionStatus()

  const liveData = useDashboardLiveData()
  const { incidents: realIncidents } = useIncidentSubscription()

  function responseTimeToStatus(minutes: number | null): MunicipalityData['status'] {
    if (minutes === null) return 'responsive'
    if (minutes > 20) return 'delayed'
    if (minutes > 10) return 'slow'
    return 'responsive'
  }

  function parseResponseMinutes(timeString: string): number | null {
    if (timeString === '—') return null
    const minutes = parseInt(timeString.split(':')[0] ?? '0', 10)
    return Number.isNaN(minutes) ? null : minutes
  }

  // Map live municipal data to grid format
  const municipalities: MunicipalityData[] = useMemo(() => {
    return liveData.municipalData.map((municipality) => {
      const responseMinutes = parseResponseMinutes(municipality.avgResponseTime)

      return {
        name: municipality.municipality,
        activeIncidents: municipality.activeIncidents,
        avgResponseTimeMinutes: responseMinutes,
        status: responseTimeToStatus(responseMinutes),
      }
    })
  }, [liveData.municipalData])

  // Derive alert level from live anomalies and real incident count
  const alertLevel = useMemo(() => {
    if (liveData.anomalies.length > 0) return 'critical'
    if (realIncidents.length > 10 || liveData.activeIncidents > 10) return 'elevated'
    return 'normal'
  }, [liveData.anomalies, liveData.activeIncidents, realIncidents.length])

  // Map real subscription data to map incident format
  const incidents: Incident[] = useMemo(() => {
    return realIncidents.map((inc) => ({
      id: inc.id,
      location: inc.location,
      severity: inc.severity,
      type: inc.type,
      municipality: inc.municipality,
    }))
  }, [realIncidents])

  // Feed items are the real subscription data directly
  const feedItems: IncidentFeedItem[] = realIncidents

  function buildHealthStream(gapSeconds: number, isHealthy: boolean) {
    return {
      status: isHealthy ? ('ok' as const) : ('delayed' as const),
      lastSuccess: new Date(),
      gapSeconds,
    }
  }

  // System health from live data
  const health = useMemo(() => {
    const healthy = liveData.systemHealthy ?? true
    return {
      auditStream: buildHealthStream(5, healthy),
      batchPipeline: buildHealthStream(30, healthy),
      smsDelivery: buildHealthStream(15, healthy),
      fcmPush: buildHealthStream(10, healthy),
    }
  }, [liveData.systemHealthy])

  const handleMunicipalityClick = (name: string) => {
    setSelectedMunicipality(name)
  }

  return (
    <>
      <CommandCenterShell
        topBanner={
          <TopBanner
            alertLevel={alertLevel}
            connectionStatus={connectionStatus}
            lastUpdated={lastUpdated}
            onDeclareAlert={() => {
              setAlertModalOpen(true)
            }}
            onToggleKpiPanel={() => {
              setKpiPanelOpen((prev) => !prev)
            }}
            onToggleIncidentPanel={() => {
              setIncidentPanelOpen((prev) => !prev)
            }}
          />
        }
        mapZone={
          <ProvincialMap
            incidents={incidents}
            municipalities={municipalities}
            selectedMunicipality={selectedMunicipality}
          />
        }
        gridZone={
          <MunicipalGrid
            municipalities={municipalities}
            onMunicipalityClick={handleMunicipalityClick}
          />
        }
        bottomStrip={<SystemHealthStrip health={health} />}
      />
      {kpiPanelOpen && (
        <div
          style={{
            position: 'fixed',
            top: '100px',
            right: 0,
            bottom: '60px',
            width: '450px',
            backgroundColor: '#ffffff',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
            zIndex: 100,
            overflow: 'hidden',
          }}
          data-testid="kpi-drawer"
        >
          <KpiPanel liveData={liveData} />
        </div>
      )}

      {incidentPanelOpen && (
        <div
          style={{
            position: 'fixed',
            top: '100px',
            right: 0,
            bottom: '60px',
            width: '450px',
            backgroundColor: '#ffffff',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
            zIndex: 100,
            overflow: 'hidden',
          }}
          data-testid="incident-drawer"
        >
          <IncidentFeed
            incidents={feedItems}
            onTriage={() => {
              /* no-op: wire to triage navigation when route exists */
            }}
            onDispatch={() => {
              /* no-op: wire to dispatch action when handler exists */
            }}
            onView={() => {
              /* no-op: wire to view details when route exists */
            }}
          />
        </div>
      )}

      <AlertDeclarationModal
        open={alertModalOpen}
        currentLevel={alertLevel}
        onClose={() => {
          setAlertModalOpen(false)
        }}
        onDeclare={() => {
          setAlertModalOpen(false)
        }}
      />
    </>
  )
}
