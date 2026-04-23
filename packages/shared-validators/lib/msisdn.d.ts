import { z } from 'zod';
export declare class MsisdnInvalidError extends Error {
    constructor(input: string);
}
export declare const msisdnPhSchema: z.ZodString;
export declare function normalizeMsisdn(input: string): string;
export declare function hashMsisdn(normalizedMsisdn: string, salt: string): string;
//# sourceMappingURL=msisdn.d.ts.map