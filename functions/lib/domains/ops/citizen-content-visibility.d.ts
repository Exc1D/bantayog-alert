import { type Firestore } from 'firebase-admin/firestore';
declare const SURFACES: readonly ["feed", "alerts"];
declare const VISIBILITIES: readonly ["public", "internal"];
declare const REASONS: readonly ["sensitive_content", "privacy_request", "false_or_misleading", "legal_request", "other"];
type CitizenContentSurface = (typeof SURFACES)[number];
type CitizenContentVisibility = (typeof VISIBILITIES)[number];
type CitizenContentReason = (typeof REASONS)[number];
export interface SetCitizenContentVisibilityDeps {
    surface: CitizenContentSurface;
    contentId: string;
    visibility: CitizenContentVisibility;
    reason: CitizenContentReason;
    idempotencyKey?: string;
    actor: {
        uid: string;
        claims: {
            role?: string;
            municipalityId?: string;
        };
    };
    now: number;
}
export declare function setCitizenContentVisibilityCore(db: Firestore, deps: SetCitizenContentVisibilityDeps): Promise<{
    surface: CitizenContentSurface;
    contentId: string;
    visibility: CitizenContentVisibility;
    updatedAt: number;
}>;
export declare const setCitizenContentVisibility: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    surface: CitizenContentSurface;
    contentId: string;
    visibility: CitizenContentVisibility;
    updatedAt: number;
}>, unknown>;
export {};
//# sourceMappingURL=citizen-content-visibility.d.ts.map