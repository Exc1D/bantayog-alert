export function timeAgo(timestamp: number, capAt30Days = false): string {
  if (timestamp <= 0) return 'time pending'
  const minutes = Math.floor((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  const days = Math.floor(hours / 24)
  if (capAt30Days && days > 30) return 'over 30 days ago'
  return `${String(days)}d ago`
}
