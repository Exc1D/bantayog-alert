interface OfflineIndicatorProps {
  isOnline: boolean
}

export function OfflineIndicator({ isOnline }: OfflineIndicatorProps) {
  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-gray-800 text-white px-4 py-2 text-center z-50">
      <p className="text-sm">You're offline. Reports will be queued.</p>
    </div>
  )
}
