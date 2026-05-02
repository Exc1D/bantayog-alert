const KEY = 'bantayog.last-phone'
const DEFAULT_PHONE = '+63'

function isBenignStorageError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const name = err.name
  const msg = err.message.toLowerCase()
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    name === 'SecurityError' ||
    msg.includes('quota') ||
    msg.includes('private') ||
    msg.includes('denied')
  )
}

export function getStoredPhone(): string {
  try {
    return sessionStorage.getItem(KEY) ?? DEFAULT_PHONE
  } catch (err: unknown) {
    if (!isBenignStorageError(err)) {
      console.warn('[phone-session-storage] Unexpected error reading last-phone:', err)
    }
    return DEFAULT_PHONE
  }
}

export function setStoredPhone(phone: string): void {
  try {
    sessionStorage.setItem(KEY, phone)
  } catch (err: unknown) {
    if (!isBenignStorageError(err)) {
      console.warn('[phone-session-storage] Unexpected error writing last-phone:', err)
    }
    // Private mode / quota / security errors — best effort persistence.
  }
}
