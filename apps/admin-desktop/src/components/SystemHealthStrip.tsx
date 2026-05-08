interface HealthService {
  status: 'ok' | 'delayed' | 'down'
  lastSuccess: Date
  gapSeconds: number
}

interface SystemHealth {
  auditStream: HealthService
  batchPipeline: HealthService
  smsDelivery: HealthService
  fcmPush: HealthService
}

interface SystemHealthStripProps {
  health: SystemHealth
}

export function SystemHealthStrip({ health }: SystemHealthStripProps) {
  const services = [
    { key: 'auditStream', label: 'AUDIT STREAM', data: health.auditStream },
    { key: 'batchPipeline', label: 'BATCH', data: health.batchPipeline },
    { key: 'smsDelivery', label: 'SMS', data: health.smsDelivery },
    { key: 'fcmPush', label: 'FCM', data: health.fcmPush },
  ] as const

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return '#2d6a4f'
      case 'delayed':
        return '#c77600'
      case 'down':
        return '#a73400'
      default:
        return '#6c757d'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ok':
        return 'OK'
      case 'delayed':
        return 'DELAYED'
      case 'down':
        return 'DOWN'
      default:
        return 'UNKNOWN'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '12px 24px',
        backgroundColor: '#e9ecef',
        borderTop: '1px solid #dee2e6',
        height: '60px',
      }}
    >
      {services.map((service) => (
        <div
          key={service.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(service.data.status),
              animation:
                service.data.status === 'delayed'
                  ? 'pulse 2s infinite'
                  : service.data.status === 'down'
                    ? 'pulse 1s infinite'
                    : 'none',
            }}
          />
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#495057',
                textTransform: 'uppercase',
              }}
            >
              {service.label}
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: getStatusColor(service.data.status),
              }}
            >
              {getStatusText(service.data.status)}
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
