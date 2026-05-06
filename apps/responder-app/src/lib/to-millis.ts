export function toMillis(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (
    value !== null &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as Record<string, unknown>).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis()
  }
  return undefined
}
