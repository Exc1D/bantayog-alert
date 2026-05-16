export function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (diffSec < 60) return `${String(diffSec)}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${String(diffMin)}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${String(diffHr)}h ago`
  return `${String(Math.floor(diffHr / 24))}d ago`
}
