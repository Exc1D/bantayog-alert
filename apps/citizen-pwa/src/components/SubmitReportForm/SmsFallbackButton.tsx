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
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const separator = isIOS ? '&' : '?'
    window.location.href = `sms:${separator}body=${encoded}`
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full py-3 px-4 rounded-lg bg-surface-900 text-white font-semibold cursor-pointer border-none"
    >
      Send as SMS
    </button>
  )
}
