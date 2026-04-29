import type { Firestore } from 'firebase-admin/firestore';
/**
 * Persists a scraper-derived signal to Firestore after validating it against hazardSignalDocSchema.
 *
 * @param db - Firestore instance
 * @param signal - Parsed signal data from the PAGASA scraper
 * @param _now - Timestamp (reserved for future use)
 */
export declare function upsertScraperSignal(db: Firestore, signal: {
    signalId: string;
    hazardType: 'tropical_cyclone';
    signalLevel: number;
    source: 'scraper';
    scopeType: 'municipalities' | 'province';
    affectedMunicipalityIds: string[];
    status: 'active';
    validFrom: number;
    validUntil: number;
    recordedAt: number;
    rawSource: string;
    schemaVersion: number;
}, _now: number): Promise<void>;
/**
 * Writes a dead-letter record for a failed scraper or projection operation.
 *
 * @param db - Firestore instance
 * @param category - Dead letter category (`pagasa_scraper` or `hazard_signal_projection`)
 * @param payload - The failed payload (HTML string or error details)
 * @param _now - Timestamp (reserved for future use)
 */
export declare function writeSignalDeadLetter(db: Firestore, category: string, reason: string, payload: unknown, _now: number): Promise<void>;
/**
 * Marks the scraper as degraded by updating `hazard_signal_status/current` with a degradation reason.
 *
 * @param db - Firestore instance
 * @param now - Current timestamp
 * @param reason - Human-readable reason for degradation
 */
export declare function markScraperDegraded(db: Firestore, now: number, reason: string): Promise<void>;
/**
 * Clears the scraper degraded state by removing degradation reasons from `hazard_signal_status/current`.
 *
 * @param db - Firestore instance
 * @param now - Current timestamp
 */
export declare function clearScraperDegraded(db: Firestore, now: number): Promise<void>;
export type ParseResult = {
    ok: true;
    value: {
        signalId: string;
        [key: string]: unknown;
    };
} | {
    ok: false;
    reason: string;
};
export declare function parsePagasaSignal(html: string): ParseResult;
/**
 * Determines whether a parsed PAGASA signal is trusted by verifying all affected
 * municipality IDs are in the canonical Camarines Norte set.
 *
 * @param signal - Parsed signal record
 * @returns True if all affected municipality IDs are recognized
 */
export declare function isTrustedParsedSignal(signal: Record<string, unknown>): boolean;
export interface PagasaSignalPollResult {
    status: 'updated' | 'quarantined' | 'failed';
    scraperDegraded: boolean;
}
/**
 * Orchestrates the PAGASA TCWS scraping pipeline: fetches HTML, parses signals,
 * validates against the trust allowlist, writes trusted signals to Firestore,
 * and replays the projection. On failure, writes a dead letter and marks degradation.
 *
 * @param input - Firestore instance, HTML fetch function, and optional now() override
 * @returns Result with status, scraper degradation flag
 */
export declare function pagasaSignalPollCore(input: {
    db: Firestore;
    fetchHtml: () => Promise<string>;
    now?: () => number;
}): Promise<PagasaSignalPollResult>;
//# sourceMappingURL=pagasa-signal-poll.d.ts.map