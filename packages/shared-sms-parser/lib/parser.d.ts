import { z } from 'zod';
export type Confidence = 'high' | 'medium' | 'low' | 'none';
export declare const reportTypeSchema: z.ZodEnum<{
    flood: "flood";
    fire: "fire";
    landslide: "landslide";
    accident: "accident";
    medical: "medical";
    other: "other";
}>;
export type ReportType = z.infer<typeof reportTypeSchema>;
export interface ParsedFields {
    reportType: ReportType;
    barangay: string;
    rawBarangay?: string;
    details: string | undefined;
}
export interface ParseResult {
    confidence: Confidence;
    parsed: ParsedFields | null;
    candidates: string[];
    autoReplyText: string;
}
export declare function parseInboundSms(body: string): ParseResult;
//# sourceMappingURL=parser.d.ts.map