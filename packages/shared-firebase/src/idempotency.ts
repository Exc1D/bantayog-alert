/** §6.2 — Idempotency key: (actor, commandType, logicalTarget), 24h TTL */
export function generateIdempotencyKey(
  actorId: string,
  commandType: string,
  logicalTarget: string,
): string {
  return `${actorId}:${commandType}:${logicalTarget}`
}

export function parseIdempotencyKey(
  key: string,
): { actorId: string; commandType: string; logicalTarget: string } | null {
  const parts = key.split(':')
  if (parts.length !== 3) return null
  return { actorId: parts[0], commandType: parts[1], logicalTarget: parts[2] }
}
