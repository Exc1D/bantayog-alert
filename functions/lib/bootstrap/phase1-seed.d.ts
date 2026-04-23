export declare function buildPhase1SeedDocs(updatedAt: number): {
    systemConfig: {
        min_app_version: {
            citizen: string;
            admin: string;
            responder: string;
            updatedAt: number;
        };
    };
    alerts: {
        id: string;
        title: string;
        body: string;
        severity: string;
        publishedAt: number;
        publishedBy: string;
    }[];
};
//# sourceMappingURL=phase1-seed.d.ts.map