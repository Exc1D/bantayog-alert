import { AlertCircle, CheckCircle, HelpCircle, XCircle } from 'lucide-react'

interface Props {
  result: string | null
  warnings: string[] | null
}

const STATUS_CONFIG: Record<
  string,
  { Icon: typeof CheckCircle; colorClass: string; ariaLabel: string }
> = {
  sent: { Icon: CheckCircle, colorClass: 'text-green-600', ariaLabel: 'FCM delivered to device' },
  network_error: { Icon: XCircle, colorClass: 'text-red-600', ariaLabel: 'FCM network error' },
  no_token: { Icon: AlertCircle, colorClass: 'text-amber-500', ariaLabel: 'No FCM token' },
}

export function FcmStatusIcon({ result }: Props) {
  const cfg = result ? STATUS_CONFIG[result] : undefined

  const Icon = cfg?.Icon ?? HelpCircle
  const colorClass = cfg?.colorClass ?? 'text-gray-500'
  const ariaLabel = cfg?.ariaLabel ?? 'FCM status unknown'

  return <Icon className={colorClass} aria-label={ariaLabel} />
}
