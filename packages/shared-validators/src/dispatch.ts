/** §5.4 — Canonical responder-direct transitions (mirrored in Firestore rules) */
const VALID_RESPONDER_TRANSITIONS: ReadonlySet<string> = new Set([
  'accepted:acknowledged',
  'acknowledged:in_progress',
  'in_progress:resolved',
  'pending:declined',
])

export function validResponderTransition(from: string, to: string): boolean {
  return VALID_RESPONDER_TRANSITIONS.has(`${from}:${to}`)
}
