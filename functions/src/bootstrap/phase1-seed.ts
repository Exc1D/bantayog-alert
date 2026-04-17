export function buildPhase1SeedDocs(updatedAt: number) {
  return {
    systemConfig: {
      min_app_version: {
        citizen: '0.1.0',
        admin: '0.1.0',
        responder: '0.1.0',
        updatedAt,
      },
    },
    alerts: [
      {
        id: 'phase1-hello',
        title: 'System online',
        body: 'Citizen shell wired for Phase 1.',
        severity: 'info',
        publishedAt: updatedAt,
        publishedBy: 'phase-1-bootstrap',
      },
    ],
  }
}
