export interface ScopedOperationsMapIncidentPayload {
    reportId: string;
    report: {
        municipalityId: string;
        municipalityLabel?: string;
        barangayId?: string;
        reportType?: string;
        severity?: string;
        status?: string;
        description?: string;
        publicLocation?: {
            lat: number;
            lng: number;
        };
        submittedAt?: number;
        updatedAt?: number;
        activeResponderCount?: number;
    };
}
//# sourceMappingURL=callables.d.ts.map