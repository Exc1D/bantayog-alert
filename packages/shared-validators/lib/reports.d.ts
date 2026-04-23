import { z } from 'zod';
export declare const hazardTagSchema: z.ZodObject<{
    hazardZoneId: z.ZodString;
    geohash: z.ZodString;
    hazardType: z.ZodEnum<{
        flood: "flood";
        landslide: "landslide";
        storm_surge: "storm_surge";
    }>;
}, z.core.$strict>;
export declare const reportDocSchema: z.ZodObject<{
    municipalityId: z.ZodString;
    barangayId: z.ZodString;
    reporterRole: z.ZodEnum<{
        citizen: "citizen";
        responder: "responder";
    }>;
    reportType: z.ZodEnum<{
        flood: "flood";
        landslide: "landslide";
        storm_surge: "storm_surge";
        fire: "fire";
        earthquake: "earthquake";
        typhoon: "typhoon";
        medical: "medical";
        accident: "accident";
        structural: "structural";
        security: "security";
        other: "other";
    }>;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    status: z.ZodEnum<{
        cancelled: "cancelled";
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
        draft_inbox: "draft_inbox";
        new: "new";
        awaiting_verify: "awaiting_verify";
        verified: "verified";
        assigned: "assigned";
        closed: "closed";
        reopened: "reopened";
        rejected: "rejected";
        cancelled_false_report: "cancelled_false_report";
        merged_as_duplicate: "merged_as_duplicate";
    }>;
    publicLocation: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, z.core.$strict>;
    mediaRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
    description: z.ZodString;
    submittedAt: z.ZodNumber;
    verifiedAt: z.ZodOptional<z.ZodNumber>;
    retentionExempt: z.ZodDefault<z.ZodBoolean>;
    visibilityClass: z.ZodEnum<{
        internal: "internal";
        public_alertable: "public_alertable";
    }>;
    visibility: z.ZodObject<{
        scope: z.ZodEnum<{
            provincial: "provincial";
            municipality: "municipality";
            shared: "shared";
        }>;
        sharedWith: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>;
    source: z.ZodEnum<{
        web: "web";
        sms: "sms";
        responder_witness: "responder_witness";
    }>;
    hasPhotoAndGPS: z.ZodDefault<z.ZodBoolean>;
    schemaVersion: z.ZodNumber;
    municipalityLabel: z.ZodString;
    correlationId: z.ZodUUID;
}, z.core.$strict>;
export declare const reportPrivateDocSchema: z.ZodObject<{
    municipalityId: z.ZodString;
    reporterUid: z.ZodString;
    isPseudonymous: z.ZodBoolean;
    publicTrackingRef: z.ZodString;
    createdAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const reportOpsDocSchema: z.ZodObject<{
    municipalityId: z.ZodString;
    status: z.ZodEnum<{
        cancelled: "cancelled";
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
        draft_inbox: "draft_inbox";
        new: "new";
        awaiting_verify: "awaiting_verify";
        verified: "verified";
        assigned: "assigned";
        closed: "closed";
        reopened: "reopened";
        rejected: "rejected";
        cancelled_false_report: "cancelled_false_report";
        merged_as_duplicate: "merged_as_duplicate";
    }>;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    createdAt: z.ZodNumber;
    agencyIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    activeResponderCount: z.ZodDefault<z.ZodNumber>;
    requiresLocationFollowUp: z.ZodDefault<z.ZodBoolean>;
    visibility: z.ZodObject<{
        scope: z.ZodEnum<{
            provincial: "provincial";
            municipality: "municipality";
            shared: "shared";
        }>;
        sharedWith: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>;
    updatedAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const reportSharingDocSchema: z.ZodObject<{
    ownerMunicipalityId: z.ZodString;
    reportId: z.ZodString;
    sharedWith: z.ZodArray<z.ZodString>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const reportContactsDocSchema: z.ZodObject<{
    reportId: z.ZodString;
    reporterUid: z.ZodString;
    reporterName: z.ZodOptional<z.ZodString>;
    reporterPhoneHash: z.ZodString;
    createdAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const reportLookupDocSchema: z.ZodObject<{
    publicTrackingRef: z.ZodString;
    reportId: z.ZodString;
    tokenHash: z.ZodString;
    expiresAt: z.ZodNumber;
    createdAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const reportInboxDocSchema: z.ZodObject<{
    reporterUid: z.ZodString;
    clientCreatedAt: z.ZodNumber;
    idempotencyKey: z.ZodString;
    publicRef: z.ZodString;
    secretHash: z.ZodString;
    correlationId: z.ZodUUID;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    processedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type HazardTag = z.infer<typeof hazardTagSchema>;
export type ReportDoc = z.infer<typeof reportDocSchema>;
export type ReportPrivateDoc = z.infer<typeof reportPrivateDocSchema>;
export type ReportOpsDoc = z.infer<typeof reportOpsDocSchema>;
export type ReportSharingDoc = z.infer<typeof reportSharingDocSchema>;
export type ReportContactsDoc = z.infer<typeof reportContactsDocSchema>;
export type ReportLookupDoc = z.infer<typeof reportLookupDocSchema>;
export type ReportInboxDoc = z.infer<typeof reportInboxDocSchema>;
export declare const inboxPayloadSchema: z.ZodObject<{
    reportType: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    source: z.ZodEnum<{
        web: "web";
        sms: "sms";
        responder_witness: "responder_witness";
    }>;
    clientDraftRef: z.ZodOptional<z.ZodString>;
    publicLocation: z.ZodOptional<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, z.core.$strict>>;
    pendingMediaIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    municipalityId: z.ZodOptional<z.ZodString>;
    barangayId: z.ZodOptional<z.ZodString>;
    nearestLandmark: z.ZodOptional<z.ZodString>;
    contact: z.ZodOptional<z.ZodObject<{
        phone: z.ZodString;
        smsConsent: z.ZodLiteral<true>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type InboxPayload = z.infer<typeof inboxPayloadSchema>;
//# sourceMappingURL=reports.d.ts.map