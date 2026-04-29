import { type Firestore } from 'firebase-admin/firestore';
/**
 * Declares a new hazard signal (tropical cyclone warning) for a province or set of municipalities.
 * Validates the actor's superadmin role, normalizes province scope to all Camarines Norte
 * municipalities, writes the signal document, and triggers a projection replay.
 *
 * @param db - Firestore instance
 * @param input - Signal parameters (signalLevel, scopeType, affectedMunicipalityIds, validUntil, reason)
 * @param actor - Authenticated user with uid and role
 * @returns The created signalId and the normalized list of affected municipality IDs
 * @throws HttpsError('permission-denied') if actor is not provincial_superadmin
 */
export declare function declareHazardSignalCore(db: Firestore, input: unknown, actor: {
    uid: string;
    role: string;
}): Promise<{
    signalId: string;
    affectedMunicipalityIds: string[];
}>;
/**
 * Clears an active hazard signal by marking it as cleared with the actor's uid and timestamp.
 * Verifies the signal exists and is currently active before clearing, then triggers a
 * projection replay to update the live status.
 *
 * @param db - Firestore instance
 * @param input - Clear parameters (signalId, reason)
 * @param actor - Authenticated user with uid and role
 * @returns The cleared signalId and status
 * @throws HttpsError('permission-denied') if actor is not provincial_superadmin
 * @throws HttpsError('not-found') if the signal document does not exist
 * @throws HttpsError('failed-precondition') if the signal is not currently active
 */
export declare function clearHazardSignalCore(db: Firestore, input: unknown, actor: {
    uid: string;
    role: string;
}): Promise<{
    signalId: string;
    status: 'cleared';
}>;
export declare const declareHazardSignal: import("firebase-functions/https").CallableFunction<any, Promise<{
    signalId: string;
    affectedMunicipalityIds: string[];
}>, unknown>;
export declare const clearHazardSignal: import("firebase-functions/https").CallableFunction<any, Promise<{
    signalId: string;
    status: "cleared";
}>, unknown>;
//# sourceMappingURL=declare-hazard-signal.d.ts.map