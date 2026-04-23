export type SmsEncoding = 'GSM-7' | 'UCS-2';
export interface EncodingResult {
    encoding: SmsEncoding;
    segmentCount: number;
}
/**
 * Detect whether a message body can be encoded using GSM-7 or requires UCS-2.
 *
 * GSM-7: each basic char = 1 code unit; each extension char = 2 code units.
 *   Single-segment limit: 160 code units.  Multi-segment: 153 per segment.
 * UCS-2: each char (including emoji) = 1 UTF-16 code unit.
 *   Single-segment limit: 70 chars.  Multi-segment: 67 per segment.
 */
export declare function detectEncoding(body: string): EncodingResult;
//# sourceMappingURL=sms-encoding.d.ts.map