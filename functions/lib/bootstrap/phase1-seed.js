export function buildPhase1SeedDocs(updatedAt) {
    const updateUrls = {
        citizen: 'https://bantayog.camarines-norte.gov.ph',
        responder: 'https://testflight.apple.com/join/REPLACE_WITH_TOKEN',
        admin: 'https://admin.bantayog.camarines-norte.gov.ph',
    };
    return {
        systemConfig: {
            min_app_version: {
                citizen: '1.0.0',
                admin: '1.0.0',
                responder: '1.0.0',
                updatedAt,
            },
            update_urls: updateUrls,
        },
        alerts: [
            {
                id: 'phase1-hello',
                title: 'System online',
                body: 'Bantayog Alert v1.0.0-pilot is live.',
                severity: 'info',
                publishedAt: updatedAt,
                publishedBy: 'phase-1-bootstrap',
            },
        ],
    };
}
//# sourceMappingURL=phase1-seed.js.map