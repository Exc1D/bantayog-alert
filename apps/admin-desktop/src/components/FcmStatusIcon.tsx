import { AlertCircle, CheckCircle, HelpCircle, XCircle } from 'lucide-react'

interface Props {
  result: string | null
}

const STATUS_CONFIG: Record<
  string,
  { Icon: typeof CheckCircle; colorClass: string; ariaLabel: string }
> = {
  sent: { Icon: CheckCircle, colorClass: 'text-[var(--color-success)]', ariaLabel: 'FCM delivered to device' },
  network_error: { Icon: XCircle, colorClass: 'text-[var(--color-danger)]', ariaLabel: 'FCM network error' },
  no_token: { Icon: AlertCircle, colorClass: 'text-[var(--color-warning)]', ariaLabel: 'No FCM token' },
}

export function FcmStatusIcon({ result }: Props) {
  const cfg = result ? STATUS_CONFIG[result] : undefined

  const Icon = cfg?.Icon ?? HelpCircle
  const colorClass = cfg?.colorClass ?? 'text-[var(--color-text-muted)]'
  const ariaLabel = cfg?.ariaLabel ?? 'FCM status unknown'

  return <Icon className={colorClass} aria-label={ariaLabel} />
}
