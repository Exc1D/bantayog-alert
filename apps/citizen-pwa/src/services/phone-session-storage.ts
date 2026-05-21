// In-memory phone storage — never persisted to disk.
// Mitigates XSS data exfiltration: even if a malicious script runs,
// it cannot read phone numbers from sessionStorage/localStorage.
// CSP headers (firebase.json) provide additional XSS protection.
// Trade-off: phone number is lost on page refresh (acceptable for emergency reporting flow).

const DEFAULT_PHONE = '+63'
let storedPhone: string | null = null

export function getStoredPhone(): string {
  return storedPhone ?? DEFAULT_PHONE
}

export function setStoredPhone(phone: string): void {
  storedPhone = phone
}
