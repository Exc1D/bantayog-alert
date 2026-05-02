const KEY = 'bantayog.last-phone'
const DEFAULT_PHONE = '+63'

export function getStoredPhone(): string {
  try {
    return sessionStorage.getItem(KEY) ?? DEFAULT_PHONE
  } catch {
    return DEFAULT_PHONE
  }
}

export function setStoredPhone(phone: string): void {
  try {
    sessionStorage.setItem(KEY, phone)
  } catch {
    // Private mode / quota / security errors — best effort persistence.
  }
}
