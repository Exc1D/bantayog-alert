import { CAMARINES_NORTE_MUNICIPALITIES, hazardSignalDocSchema } from '@bantayog/shared-validators';
import { replayHazardSignalProjection } from '../services/hazard-signal-projector.js';
/**
 * Persists a scraper-derived signal to Firestore after validating it against hazardSignalDocSchema.
 *
 * @param db - Firestore instance
 * @param signal - Parsed signal data from the PAGASA scraper
 * @param _now - Timestamp (reserved for future use)
 */
export async function upsertScraperSignal(db, signal, _now) {
    void _now;
    const payload = {
        ...signal,
        schemaVersion: 1,
    };
    const parsed = hazardSignalDocSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(`Invalid scraper signal: ${parsed.error.message}`);
    }
    await db.collection('hazard_signals').doc(signal.signalId).set(parsed.data);
}
/**
 * Writes a dead-letter record for a failed scraper or projection operation.
 *
 * @param db - Firestore instance
 * @param category - Dead letter category (`pagasa_scraper` or `hazard_signal_projection`)
 * @param payload - The failed payload (HTML string or error details)
 * @param _now - Timestamp (reserved for future use)
 */
export async function writeSignalDeadLetter(db, category, reason, payload, _now) {
    void _now;
    await db.collection('dead_letters').add({
        category,
        reason,
        payload,
        createdAt: Date.now(),
    });
}
/**
 * Marks the scraper as degraded by updating `hazard_signal_status/current` with a degradation reason.
 *
 * @param db - Firestore instance
 * @param now - Current timestamp
 * @param reason - Human-readable reason for degradation
 */
export async function markScraperDegraded(db, now, reason) {
    const existing = await db.collection('hazard_signal_status').doc('current').get();
    const existingData = existing.data() ?? {};
    const existingReasons = Array.isArray(existingData.degradedReasons)
        ? existingData.degradedReasons
        : [];
    await db
        .collection('hazard_signal_status')
        .doc('current')
        .set({
        scraperDegraded: true,
        degradedReasons: [...new Set([...existingReasons, reason])],
        lastProjectedAt: now,
    }, { merge: true });
}
/**
 * Clears the scraper degraded state by removing degradation reasons from `hazard_signal_status/current`.
 *
 * @param db - Firestore instance
 * @param now - Current timestamp
 */
export async function clearScraperDegraded(db, now) {
    await db
        .collection('hazard_signal_status')
        .doc('current')
        .set({
        scraperDegraded: false,
        degradedReasons: [],
        lastProjectedAt: now,
    }, { merge: true });
}
export function parsePagasaSignal(html) {
    const tcwsMatch = /TCWS\s*#?(\d+)/i.exec(html);
    if (!tcwsMatch) {
        return { ok: false, reason: 'no_tcws_signal_found' };
    }
    const levelStr = tcwsMatch[1];
    if (!levelStr) {
        return { ok: false, reason: 'invalid_signal_level' };
    }
    const signalLevel = parseInt(levelStr, 10);
    if (isNaN(signalLevel) || signalLevel < 1 || signalLevel > 5) {
        return { ok: false, reason: 'invalid_signal_level' };
    }
    const municipalityIds = [];
    const municipalityPatterns = [
        'Daet',
        'Basud',
        'Capalonga',
        'Jose Panganiban',
        'Labo',
        'Mercedes',
        'Paracale',
        'San Lorenzo Ruiz',
        'San Vicente',
        'Santa Elena',
        'Talisay',
        'Vinzons',
    ];
    for (const pattern of municipalityPatterns) {
        if (html.includes(pattern)) {
            const id = pattern.toLowerCase().replace(/\s+/g, '-');
            if (!municipalityIds.includes(id)) {
                municipalityIds.push(id);
            }
        }
    }
    if (municipalityIds.length === 0) {
        return { ok: false, reason: 'no_municipality_found' };
    }
    const firstId = municipalityIds[0];
    const signalId = `sig-tcws${String(signalLevel)}-${String(firstId)}`;
    return {
        ok: true,
        value: {
            signalId,
            hazardType: 'tropical_cyclone',
            signalLevel,
            source: 'scraper',
            scopeType: municipalityIds.length === CAMARINES_NORTE_MUNICIPALITIES.length
                ? 'province'
                : 'municipalities',
            affectedMunicipalityIds: municipalityIds,
            status: 'active',
            validFrom: Date.now(),
            validUntil: Date.now() + 3600000,
            recordedAt: Date.now(),
            rawSource: 'pagasa_scraper',
            schemaVersion: 1,
        },
    };
}
/**
 * Determines whether a parsed PAGASA signal is trusted by verifying all affected
 * municipality IDs are in the canonical Camarines Norte set.
 *
 * @param signal - Parsed signal record
 * @returns True if all affected municipality IDs are recognized
 */
export function isTrustedParsedSignal(signal) {
    const KNOWN_MUNICIPALITIES = new Set(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id));
    const affected = signal.affectedMunicipalityIds;
    if (!Array.isArray(affected))
        return false;
    for (const m of affected) {
        if (!KNOWN_MUNICIPALITIES.has(m)) {
            return false;
        }
    }
    return true;
}
/**
 * Orchestrates the PAGASA TCWS scraping pipeline: fetches HTML, parses signals,
 * validates against the trust allowlist, writes trusted signals to Firestore,
 * and replays the projection. On failure, writes a dead letter and marks degradation.
 *
 * @param input - Firestore instance, HTML fetch function, and optional now() override
 * @returns Result with status, scraper degradation flag
 */
export async function pagasaSignalPollCore(input) {
    const now = input.now ?? (() => Date.now());
    let fetchedHtml;
    try {
        fetchedHtml = await input.fetchHtml();
        const html = fetchedHtml;
        const parsed = parsePagasaSignal(html);
        if (!parsed.ok) {
            await writeSignalDeadLetter(input.db, 'pagasa_scraper', parsed.reason, html, now());
            await markScraperDegraded(input.db, now(), 'parse_failed');
            return { status: 'failed', scraperDegraded: true };
        }
        if (!isTrustedParsedSignal(parsed.value)) {
            await input.db
                .collection('hazard_signals')
                .doc(parsed.value.signalId)
                .set({
                ...parsed.value,
                status: 'quarantined',
                schemaVersion: 1,
            });
            await markScraperDegraded(input.db, now(), 'quarantined_output');
            return { status: 'quarantined', scraperDegraded: true };
        }
        await upsertScraperSignal(input.db, parsed.value, now());
        await clearScraperDegraded(input.db, now());
        await replayHazardSignalProjection({ db: input.db, now: now() });
        return { status: 'updated', scraperDegraded: false };
    }
    catch (err) {
        await writeSignalDeadLetter(input.db, 'pagasa_scraper', String(err), fetchedHtml ? { html: fetchedHtml } : {}, now());
        await markScraperDegraded(input.db, now(), 'fetch_failed');
        return { status: 'failed', scraperDegraded: true };
    }
}
//# sourceMappingURL=pagasa-signal-poll.js.map