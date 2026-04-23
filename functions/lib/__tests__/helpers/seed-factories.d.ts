import { type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { ReportStatus } from '@bantayog/shared-types';
export declare const ts = 1713350400000;
/**
 * Seeds an active_accounts document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export declare function seedActiveAccount(env: RulesTestEnvironment, opts: {
    uid: string;
    role: 'citizen' | 'responder' | 'municipal_admin' | 'agency_admin' | 'provincial_superadmin';
    municipalityId?: string;
    agencyId?: string;
    permittedMunicipalityIds?: string[];
    accountStatus?: 'active' | 'suspended' | 'disabled';
}): Promise<void>;
export declare function staffClaims(opts: {
    role: 'municipal_admin' | 'agency_admin' | 'provincial_superadmin' | 'responder' | 'citizen';
    municipalityId?: string;
    agencyId?: string;
    permittedMunicipalityIds?: string[];
    accountStatus?: 'active' | 'suspended';
}): Record<string, unknown>;
/**
 * Seeds reports + report_ops + report_private using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export declare function seedReport(env: RulesTestEnvironment, reportId: string, overrides?: Partial<Record<string, unknown>>): Promise<void>;
/**
 * Seeds an agencies document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export declare function seedAgency(env: RulesTestEnvironment, agencyId: string, overrides?: Partial<Record<string, unknown>>): Promise<void>;
/**
 * Seeds a users document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export declare function seedUser(env: RulesTestEnvironment, userId: string, overrides?: Partial<Record<string, unknown>>): Promise<void>;
/**
 * Seeds a responders document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export declare function seedResponder(env: RulesTestEnvironment, responderId: string, overrides?: Partial<Record<string, unknown>>): Promise<void>;
/**
 * Seeds a dispatches document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export declare function seedDispatchRT(env: RulesTestEnvironment, dispatchId: string, overrides?: Partial<Record<string, unknown>>): Promise<void>;
import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
interface SeedVerifiedReportOptions {
    reportId?: string;
    municipalityId?: string;
    municipalityLabel?: string;
    reporterUid?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    reporterContact?: {
        phone: string;
        smsConsent: true;
        locale?: 'tl' | 'en';
    };
}
/**
 * Seeds a report at a specific lifecycle status using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 * For mid-lifecycle states (new, awaiting_verify, verified) that bypass processInboxItem.
 */
export declare function seedReportAtStatus(db: Firestore, status: ReportStatus, o?: SeedVerifiedReportOptions): Promise<{
    reportId: string;
}>;
/**
 * Seeds a responders document using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 */
export declare function seedResponderDoc(db: Firestore, o: {
    uid: string;
    municipalityId: string;
    agencyId: string;
    isActive: boolean;
    displayName?: string;
}): Promise<void>;
/**
 * Seeds a responder shift index using Firebase Realtime Database admin SDK directly.
 * Use in Cloud Functions context — not for RulesTestEnvironment RTDB context.
 */
export declare function seedResponderShift(rtdb: Database, municipalityId: string, uid: string, isOnShift: boolean): Promise<void>;
/**
 * Seeds a dispatch document using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 */
export declare function seedDispatch(db: Firestore, o: {
    dispatchId?: string;
    reportId: string;
    responderUid: string;
    agencyId?: string;
    municipalityId?: string;
    status?: 'pending' | 'accepted' | 'acknowledged' | 'en_route' | 'on_scene' | 'resolved' | 'declined' | 'timed_out' | 'superseded' | 'cancelled';
}): Promise<{
    dispatchId: string;
}>;
export {};
//# sourceMappingURL=seed-factories.d.ts.map