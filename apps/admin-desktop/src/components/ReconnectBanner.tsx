interface Props {
  actionLabel: string
}

export function ReconnectBanner({ actionLabel }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
      <span>⚠</span>
      <span>Connect to {actionLabel}</span>
    </div>
  )
}
