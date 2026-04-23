/**
 * Canonical payload hash per spec §6.2.
 * Used as the key half of idempotency guards for all write callables.
 *
 * Algorithm:
 *   1. Recursively sort object keys at every nesting level.
 *   2. JSON.stringify with no whitespace.
 *   3. SHA-256 the result; return hex.
 *
 * Arrays are NOT reordered — element order is semantic.
 * `undefined` values are rejected with TypeError (JSON.stringify would silently
 * drop them, causing hash collisions between `{ a: 1 }` and `{ a: 1, b: undefined }`).
 *
 * @throws TypeError for unsupported types (Map, Set, RegExp)
 * @throws Error for circular references
 */
export declare function canonicalPayloadHash(payload: unknown): Promise<string>;
//# sourceMappingURL=idempotency.d.ts.map