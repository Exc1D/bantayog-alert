import { z } from 'zod';
export declare const operationalStatusSchema: z.ZodEnum<{
    assigned: "assigned";
    acknowledged: "acknowledged";
    en_route: "en_route";
    on_scene: "on_scene";
    resolved: "resolved";
    closed: "closed";
    cancelled: "cancelled";
    merged_as_duplicate: "merged_as_duplicate";
    intake: "intake";
    triage: "triage";
    ready_for_dispatch: "ready_for_dispatch";
}>;
export declare const verificationStatusSchema: z.ZodEnum<{
    verified: "verified";
    rejected: "rejected";
    unverified: "unverified";
    awaiting_review: "awaiting_review";
}>;
export declare const publicationStatusSchema: z.ZodEnum<{
    public: "public";
    internal: "internal";
}>;
export declare const postgisPointSchema: z.ZodObject<{
    lng: z.ZodNumber;
    lat: z.ZodNumber;
}, z.core.$strict>;
export declare const incidentCoreSchema: z.ZodObject<{
    id: z.ZodString;
    reportType: z.ZodEnum<{
        flood: "flood";
        fire: "fire";
        earthquake: "earthquake";
        typhoon: "typhoon";
        landslide: "landslide";
        storm_surge: "storm_surge";
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
    operationalStatus: z.ZodEnum<{
        assigned: "assigned";
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
        closed: "closed";
        cancelled: "cancelled";
        merged_as_duplicate: "merged_as_duplicate";
        intake: "intake";
        triage: "triage";
        ready_for_dispatch: "ready_for_dispatch";
    }>;
    verificationStatus: z.ZodEnum<{
        verified: "verified";
        rejected: "rejected";
        unverified: "unverified";
        awaiting_review: "awaiting_review";
    }>;
    publicationStatus: z.ZodEnum<{
        public: "public";
        internal: "internal";
    }>;
    municipalityId: z.ZodString;
    municipalityLabel: z.ZodString;
    barangayId: z.ZodString;
    source: z.ZodEnum<{
        web: "web";
        responder_witness: "responder_witness";
        official: "official";
    }>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const incidentLifecycleRecordSchema: z.ZodObject<{
    incidentId: z.ZodString;
    reportId: z.ZodOptional<z.ZodString>;
    recordKind: z.ZodEnum<{
        privacy: "privacy";
        report: "report";
        verification: "verification";
        public_visibility: "public_visibility";
        dispatch: "dispatch";
        responder_status: "responder_status";
        alert: "alert";
        audit: "audit";
    }>;
    recordId: z.ZodString;
    createdAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const incidentLocationSchema: z.ZodObject<{
    incidentId: z.ZodString;
    point: z.ZodObject<{
        lng: z.ZodNumber;
        lat: z.ZodNumber;
    }, z.core.$strict>;
    accuracyMeters: z.ZodOptional<z.ZodNumber>;
    source: z.ZodEnum<{
        manual: "manual";
        gps: "gps";
        geocoder: "geocoder";
        responder_telemetry: "responder_telemetry";
    }>;
    recordedAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const postgisStoreReferenceSchema: z.ZodObject<{
    table: z.ZodEnum<{
        incident_locations: "incident_locations";
        responder_locations: "responder_locations";
        municipal_boundaries: "municipal_boundaries";
        alert_areas: "alert_areas";
        duplicate_cluster_inputs: "duplicate_cluster_inputs";
        public_incident_cards: "public_incident_cards";
    }>;
    primaryKey: z.ZodString;
    geometryColumn: z.ZodDefault<z.ZodEnum<{
        point: "point";
        geom: "geom";
    }>>;
    srid: z.ZodLiteral<4326>;
    index: z.ZodLiteral<"gist">;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const publicIncidentBBoxQuerySchema: z.ZodObject<{
    minLng: z.ZodNumber;
    minLat: z.ZodNumber;
    maxLng: z.ZodNumber;
    maxLat: z.ZodNumber;
    since: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export declare const responderNearbyQuerySchema: z.ZodObject<{
    incidentId: z.ZodString;
    point: z.ZodObject<{
        lng: z.ZodNumber;
        lat: z.ZodNumber;
    }, z.core.$strict>;
    radiusMeters: z.ZodNumber;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export declare const duplicateClusterQuerySchema: z.ZodObject<{
    incidentId: z.ZodString;
    point: z.ZodObject<{
        lng: z.ZodNumber;
        lat: z.ZodNumber;
    }, z.core.$strict>;
    radiusMeters: z.ZodNumber;
    minPoints: z.ZodNumber;
    since: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const commandRouteParamsSchema: z.ZodObject<{
    group: z.ZodEnum<{
        reports: "reports";
        incidents: "incidents";
        dispatches: "dispatches";
        alerts: "alerts";
        users: "users";
        privacy: "privacy";
        ops: "ops";
    }>;
    action: z.ZodString;
}, z.core.$strict>;
export declare const commandEnvelopeSchema: z.ZodObject<{
    group: z.ZodEnum<{
        reports: "reports";
        incidents: "incidents";
        dispatches: "dispatches";
        alerts: "alerts";
        users: "users";
        privacy: "privacy";
        ops: "ops";
    }>;
    action: z.ZodString;
    idempotencyKey: z.ZodString;
    actorUid: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strict>;
export declare const opsAppSurfaceSchema: z.ZodObject<{
    app: z.ZodLiteral<"ops">;
    layout: z.ZodEnum<{
        desktop_command: "desktop_command";
        field: "field";
    }>;
    audience: z.ZodEnum<{
        responder: "responder";
        admin: "admin";
    }>;
    role: z.ZodEnum<{
        responder: "responder";
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
        dispatcher: "dispatcher";
    }>;
    capabilities: z.ZodArray<z.ZodEnum<{
        map: "map";
        profile: "profile";
        incidents: "incidents";
        dispatches: "dispatches";
        alerts: "alerts";
        responder_status: "responder_status";
        feed: "feed";
    }>>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const publicIncidentCardSchema: z.ZodObject<{
    incidentId: z.ZodString;
    reportType: z.ZodEnum<{
        flood: "flood";
        fire: "fire";
        earthquake: "earthquake";
        typhoon: "typhoon";
        landslide: "landslide";
        storm_surge: "storm_surge";
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
    operationalStatus: z.ZodEnum<{
        assigned: "assigned";
        acknowledged: "acknowledged";
        en_route: "en_route";
        on_scene: "on_scene";
        resolved: "resolved";
        closed: "closed";
        cancelled: "cancelled";
        merged_as_duplicate: "merged_as_duplicate";
        intake: "intake";
        triage: "triage";
        ready_for_dispatch: "ready_for_dispatch";
    }>;
    municipalityId: z.ZodString;
    municipalityLabel: z.ZodString;
    barangayId: z.ZodString;
    publicSummary: z.ZodString;
    point: z.ZodObject<{
        lng: z.ZodNumber;
        lat: z.ZodNumber;
    }, z.core.$strict>;
    publishedAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const publicIncidentProjectionEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    incidentId: z.ZodString;
    occurredAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
    action: z.ZodLiteral<"publish">;
    card: z.ZodObject<{
        incidentId: z.ZodString;
        reportType: z.ZodEnum<{
            flood: "flood";
            fire: "fire";
            earthquake: "earthquake";
            typhoon: "typhoon";
            landslide: "landslide";
            storm_surge: "storm_surge";
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
        operationalStatus: z.ZodEnum<{
            assigned: "assigned";
            acknowledged: "acknowledged";
            en_route: "en_route";
            on_scene: "on_scene";
            resolved: "resolved";
            closed: "closed";
            cancelled: "cancelled";
            merged_as_duplicate: "merged_as_duplicate";
            intake: "intake";
            triage: "triage";
            ready_for_dispatch: "ready_for_dispatch";
        }>;
        municipalityId: z.ZodString;
        municipalityLabel: z.ZodString;
        barangayId: z.ZodString;
        publicSummary: z.ZodString;
        point: z.ZodObject<{
            lng: z.ZodNumber;
            lat: z.ZodNumber;
        }, z.core.$strict>;
        publishedAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        schemaVersion: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    incidentId: z.ZodString;
    occurredAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
    action: z.ZodLiteral<"refresh">;
    card: z.ZodObject<{
        incidentId: z.ZodString;
        reportType: z.ZodEnum<{
            flood: "flood";
            fire: "fire";
            earthquake: "earthquake";
            typhoon: "typhoon";
            landslide: "landslide";
            storm_surge: "storm_surge";
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
        operationalStatus: z.ZodEnum<{
            assigned: "assigned";
            acknowledged: "acknowledged";
            en_route: "en_route";
            on_scene: "on_scene";
            resolved: "resolved";
            closed: "closed";
            cancelled: "cancelled";
            merged_as_duplicate: "merged_as_duplicate";
            intake: "intake";
            triage: "triage";
            ready_for_dispatch: "ready_for_dispatch";
        }>;
        municipalityId: z.ZodString;
        municipalityLabel: z.ZodString;
        barangayId: z.ZodString;
        publicSummary: z.ZodString;
        point: z.ZodObject<{
            lng: z.ZodNumber;
            lat: z.ZodNumber;
        }, z.core.$strict>;
        publishedAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        schemaVersion: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    incidentId: z.ZodString;
    occurredAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
    action: z.ZodLiteral<"unpublish">;
}, z.core.$strict>], "action">;
export declare const auditEventSchema: z.ZodObject<{
    id: z.ZodString;
    incidentId: z.ZodString;
    actorUid: z.ZodString;
    action: z.ZodString;
    at: z.ZodNumber;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const reporterPrivacyRecordSchema: z.ZodObject<{
    incidentId: z.ZodString;
    reporterUid: z.ZodString;
    reporterPhoneHash: z.ZodOptional<z.ZodString>;
    retentionState: z.ZodEnum<{
        active: "active";
        erasure_requested: "erasure_requested";
        legal_hold: "legal_hold";
        erased: "erased";
    }>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type OperationalStatus = z.infer<typeof operationalStatusSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;
export type PostgisPoint = z.infer<typeof postgisPointSchema>;
export type IncidentCore = z.infer<typeof incidentCoreSchema>;
export type IncidentLifecycleRecord = z.infer<typeof incidentLifecycleRecordSchema>;
export type IncidentLocation = z.infer<typeof incidentLocationSchema>;
export type PostgisStoreReference = z.infer<typeof postgisStoreReferenceSchema>;
export type PublicIncidentBBoxQuery = z.infer<typeof publicIncidentBBoxQuerySchema>;
export type ResponderNearbyQuery = z.infer<typeof responderNearbyQuerySchema>;
export type DuplicateClusterQuery = z.infer<typeof duplicateClusterQuerySchema>;
export type CommandRouteParams = z.infer<typeof commandRouteParamsSchema>;
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;
export type OpsAppSurface = z.infer<typeof opsAppSurfaceSchema>;
export type PublicIncidentCard = z.infer<typeof publicIncidentCardSchema>;
export type PublicIncidentProjectionEvent = z.infer<typeof publicIncidentProjectionEventSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type ReporterPrivacyRecord = z.infer<typeof reporterPrivacyRecordSchema>;
//# sourceMappingURL=incident-core.d.ts.map