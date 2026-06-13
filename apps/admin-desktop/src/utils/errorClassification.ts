const NON_RETRYABLE_MARKERS = [
  'permission-denied',
  'permission denied',
  'permission_denied',
  'unauthorized',
  'unauthenticated',
  'invalid-argument',
  'failed-precondition',
  'validation',
] as const

export function actionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}

export function errorCode(err: unknown): string {
  if (typeof err !== 'object' || err === null || !('code' in err)) return ''
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

export function isRetryableActionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const text = `${errorCode(err)} ${message}`.toLowerCase()
  return !NON_RETRYABLE_MARKERS.some((marker) => text.includes(marker))
}
