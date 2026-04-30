/**
 * hazard-signal-projector.ts
 *
 * Pure function that projects HazardSignalStatusDoc from a list of
 * HazardSignalDoc records. No side effects — safe to call from any context.
 * Firestore write helper (replayHazardSignalProjection) is the only I/O boundary.
 *
 * Priority rules per municipality:
 *   1. manual > scraper (manual override always wins)
 *   2. newer recordedAt > older
 *   3. higher signalLevel breaks remaining ties
 */
import type { Firestore } from 'firebase-admin/firestore';
import { type HazardSignalDoc, type HazardSignalStatusDoc } from '@bantayog/shared-validators';
type SignalWithId = HazardSignalDoc & {
    id: string;
};
export declare function projectHazardSignalStatus(input: {
    now: number;
    signals: SignalWithId[];
    scraperDegraded?: boolean;
    degradedReasons?: string[];
    invalidSignalIds?: string[];
}): HazardSignalStatusDoc;
/**
 * Reads all hazard_signals docs and writes the projected status to
 * hazard_signal_status/current. Intended for scheduled triggers and
 * on-demand replay.
 */
export declare function replayHazardSignalProjection(input: {
    db: Firestore;
    now: number;
}): Promise<void>;
export {};
//# sourceMappingURL=hazard-signal-projector.d.ts.map