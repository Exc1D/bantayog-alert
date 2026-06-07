export function getFreshnessText(lastDataUpdateAt: number): string {
  const secondsAgo = Math.floor((Date.now() - lastDataUpdateAt) / 1000)
  if (secondsAgo < 60) {
    return `live ${String(secondsAgo)}s ago`
  }
  const minutesAgo = Math.floor(secondsAgo / 60)
  if (minutesAgo <= 5) {
    return `updated ${String(minutesAgo)}m ago`
  }
  return `stale ${String(minutesAgo)}m ago`
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m)}m ${String(s)}s`
}
