import type { Draft } from '../../services/draft-store.js'

interface SmsFallbackButtonProps {
  draft: Draft
  reporterMsisdn?: string
  onSent: () => void
}

function buildSmsBody(draft: Draft, reporterMsisdn?: string): string {
  const name = (draft.reporterName ?? '')
    .slice(0, 30)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00f1/gi, 'n')

  const locationStr = draft.location
    ? `${String(draft.location.lat)},${String(draft.location.lng)}`
    : 'NO_GPS'

  const hurtCount = draft.severity === 'high' ? '1' : '0'

  return [
    `BANTAYOG ${draft.clientDraftRef}`,
    `${draft.reportType.toUpperCase()} ${draft.barangay}`,
    locationStr,
    name,
    reporterMsisdn ?? '',
    `Hurt: ${hurtCount}`,
  ].join('\n')
}

export function SmsFallbackButton({ draft, reporterMsisdn, onSent }: SmsFallbackButtonProps) {
  const handleClick = () => {
    onSent()
    const body = buildSmsBody(draft, reporterMsisdn)
    const encoded = encodeURIComponent(body)
    window.location.href = `sms:?body=${encoded}`
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        backgroundColor: 'var(--color-primary)',
        color: '#fff',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        width: '100%',
      }}
    >
      Send as SMS
    </button>
  )
}
