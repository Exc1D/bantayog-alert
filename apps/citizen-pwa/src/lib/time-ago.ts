/** Compact relative time for cards and rows: "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(ts: number, now = Date.now()): string {
  // fallow-ignore-next-line code-duplication
  const minutes = Math.floor((now - ts) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

/** Spelled-out relative time for detail surfaces: "5 minutes ago", "1 hour ago". */
export function timeAgoLong(ts: number, now = Date.now()): string {
  const minutes = Math.floor((now - ts) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${String(days)} day${days === 1 ? '' : 's'} ago`
}
