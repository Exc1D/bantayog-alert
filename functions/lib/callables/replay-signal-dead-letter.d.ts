import { type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
declare const replaySignalDeadLetterInputSchema: z.ZodObject<{
    category: z.ZodEnum<{
        pagasa_scraper: "pagasa_scraper";
        hazard_signal_projection: "hazard_signal_projection";
    }>;
}, z.core.$strict>;
type ReplaySignalDeadLetterInput = z.infer<typeof replaySignalDeadLetterInputSchema>;
interface ReplaySignalDeadLetterActor {
    uid: string;
    role: string;
}
/**
 * Replays unresolved dead-letter entries for a given category.
 * For `hazard_signal_projection`, replays the full projection and marks all items resolved.
 * For `pagasa_scraper`, re-processes each dead letter's HTML payload through the
 * PAGASA poll pipeline and marks individual items resolved on success.
 *
 * @param db - Firestore instance
 * @param input - Replay category (`pagasa_scraper` or `hazard_signal_projection`)
 * @param actor - Authenticated user with role claim
 * @returns Number of dead letters successfully replayed
 * @throws HttpsError('permission-denied') if actor is not provincial_superadmin
 * @throws HttpsError('failed-precondition') if a pagasa_scraper dead letter has no replayable HTML
 */
export declare function replaySignalDeadLetterCore(db: Firestore, input: ReplaySignalDeadLetterInput, actor: ReplaySignalDeadLetterActor): Promise<{
    replayed: number;
}>;
export declare const replaySignalDeadLetter: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    replayed: number;
}>, unknown>;
export {};
//# sourceMappingURL=replay-signal-dead-letter.d.ts.map