interface Props {
  actionLabel: string
}

export function ReconnectBanner({ actionLabel }: Props) {
  const label = actionLabel.trim() || 'service'
  return (
    <div
      role="status"
      className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800"
    >
      <span aria-hidden="true">⚠</span>
      <span>Connect to {label}</span>
    </div>
  )
}
