import { useState, useEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface TopBannerProps {
  alertLevel: 'normal' | 'elevated' | 'critical'
  connectionStatus: 'live' | 'stale' | 'offline'
  lastUpdated: Date
  onDeclareAlert?: () => void
  onToggleKpiPanel?: () => void
  onToggleIncidentPanel?: () => void
}

export function TopBanner({
  alertLevel,
  connectionStatus,
  lastUpdated,
  onDeclareAlert,
  onToggleKpiPanel,
  onToggleIncidentPanel,
}: TopBannerProps) {
  const [time, setTime] = useState(new Date())
  const [animateLevel, setAnimateLevel] = useState(false)
  const prevLevelRef = useRef(alertLevel)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (prevLevelRef.current !== alertLevel) {
      setAnimateLevel(true)
      const timer = setTimeout(() => {
        setAnimateLevel(false)
      }, 3000)
      prevLevelRef.current = alertLevel
      return () => {
        clearTimeout(timer)
      }
    }
    return undefined
  }, [alertLevel])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const alertLabels = {
    normal: 'NORMAL',
    elevated: 'ELEVATED',
    critical: 'CRITICAL',
  }

  const connectionLabels = {
    live: 'LIVE',
    stale: `STALE — ${lastUpdated.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
    offline: 'OFFLINE',
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #dee2e6',
        height: '100px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#001e40',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '20px',
            fontWeight: 700,
          }}
        >
          P
        </div>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a1a2e' }}>PDRRMO</div>
          <div style={{ fontSize: '18px', color: '#495057' }}>Camarines Norte</div>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-alert-level={alertLevel}
        data-animate={animateLevel && !prefersReducedMotion ? 'true' : 'false'}
        style={{
          padding: '8px 24px',
          borderRadius: '24px',
          fontSize: '22px',
          fontWeight: 600,
          color: '#ffffff',
          backgroundColor:
            alertLevel === 'normal' ? '#2d6a4f' : alertLevel === 'elevated' ? '#c77600' : '#a73400',
          animation: animateLevel && !prefersReducedMotion ? 'alertPulse 3s ease-out' : 'none',
          transformOrigin: 'center',
        }}
      >
        {alertLabels[alertLevel]}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: '#1a1a2e',
            }}
          >
            {formatTime(time)}
          </div>
          <div
            style={{
              fontSize: '16px',
              color:
                connectionStatus === 'live'
                  ? '#2d6a4f'
                  : connectionStatus === 'stale'
                    ? '#c77600'
                    : '#a73400',
            }}
          >
            {connectionLabels[connectionStatus]}
          </div>
        </div>

        {onToggleKpiPanel && (
          <button
            aria-label="Toggle KPI panel"
            onClick={onToggleKpiPanel}
            style={{
              padding: '12px 24px',
              fontSize: '18px',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: '#001e40',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            KPIs
          </button>
        )}

        {onToggleIncidentPanel && (
          <button
            aria-label="Toggle incident feed panel"
            onClick={onToggleIncidentPanel}
            style={{
              padding: '12px 24px',
              fontSize: '18px',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: '#495057',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Incidents
          </button>
        )}

        <button
          aria-label="Declare emergency alert"
          onClick={onDeclareAlert}
          style={{
            padding: '12px 24px',
            fontSize: '18px',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: '#a73400',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Declare Alert
        </button>
      </div>
    </div>
  )
}
