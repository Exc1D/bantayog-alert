import { describe, it, expect } from 'vitest';
import { detectEncoding } from './sms-encoding.js';
describe('detectEncoding', () => {
    it('returns GSM-7 for pure ASCII', () => {
        expect(detectEncoding('Hello world')).toEqual({ encoding: 'GSM-7', segmentCount: 1 });
    });
    it('returns GSM-7 for basic-extension characters (count as 2 chars each)', () => {
        const r = detectEncoding('~{}|\\');
        expect(r.encoding).toBe('GSM-7');
        expect(r.segmentCount).toBe(1);
    });
    it('returns UCS-2 when any character is outside GSM-7', () => {
        expect(detectEncoding('Hello ñ world')).toEqual({ encoding: 'UCS-2', segmentCount: 1 });
    });
    it('returns UCS-2 for emoji', () => {
        expect(detectEncoding('Report received 🚨')).toMatchObject({ encoding: 'UCS-2' });
    });
    it('GSM-7 boundary: 160 chars = 1 segment', () => {
        const body = 'A'.repeat(160);
        expect(detectEncoding(body)).toEqual({ encoding: 'GSM-7', segmentCount: 1 });
    });
    it('GSM-7 boundary: 161 chars = 2 segments (concatenation uses 153/segment)', () => {
        const body = 'A'.repeat(161);
        expect(detectEncoding(body)).toEqual({ encoding: 'GSM-7', segmentCount: 2 });
    });
    it('GSM-7 boundary: 306 chars = 2 segments', () => {
        const body = 'A'.repeat(306);
        expect(detectEncoding(body)).toEqual({ encoding: 'GSM-7', segmentCount: 2 });
    });
    it('GSM-7 boundary: 307 chars = 3 segments', () => {
        const body = 'A'.repeat(307);
        expect(detectEncoding(body)).toEqual({ encoding: 'GSM-7', segmentCount: 3 });
    });
    it('UCS-2 boundary: 70 chars = 1 segment', () => {
        const body = 'ñ'.repeat(70);
        expect(detectEncoding(body)).toEqual({ encoding: 'UCS-2', segmentCount: 1 });
    });
    it('UCS-2 boundary: 71 chars = 2 segments (concatenation uses 67/segment)', () => {
        const body = 'ñ'.repeat(71);
        expect(detectEncoding(body)).toEqual({ encoding: 'UCS-2', segmentCount: 2 });
    });
    it('UCS-2 boundary: 134 chars = 2 segments', () => {
        const body = 'ñ'.repeat(134);
        expect(detectEncoding(body)).toEqual({ encoding: 'UCS-2', segmentCount: 2 });
    });
    it('UCS-2 boundary: 135 chars = 3 segments', () => {
        const body = 'ñ'.repeat(135);
        expect(detectEncoding(body)).toEqual({ encoding: 'UCS-2', segmentCount: 3 });
    });
    it('extension chars count double toward segment threshold', () => {
        const body = '{'.repeat(80);
        expect(detectEncoding(body)).toEqual({ encoding: 'GSM-7', segmentCount: 1 });
    });
    it('extension chars overflow into 2 segments', () => {
        const body = '{'.repeat(81);
        expect(detectEncoding(body)).toEqual({ encoding: 'GSM-7', segmentCount: 2 });
    });
});
//# sourceMappingURL=sms-encoding.test.js.map