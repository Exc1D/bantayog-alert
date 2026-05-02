export function severityMeta(severity: string): { label: string; bg: string; color: string } {
  switch (severity) {
    case 'critical':
      return { label: 'CRITICAL', bg: '#fecaca', color: '#7f1d1d' }
    case 'high':
      return { label: 'HIGH', bg: '#fee2e2', color: '#991b1b' }
    case 'medium':
      return { label: 'MEDIUM', bg: '#fff5ef', color: '#a73400' }
    case 'low':
      return { label: 'LOW', bg: '#e0e7f0', color: '#001e40' }
    default:
      return { label: 'INFO', bg: '#dbeafe', color: '#1e40af' }
  }
}
