import type { Report } from '../types'

interface Props {
  reports: Report[]
  selectedReportId: string | null
  onSelect: (reportId: string) => void
}

export function MapKeyboardNav({ reports, selectedReportId, onSelect }: Props) {
  if (reports.length === 0) return null

  return (
    <div
      className="absolute left-4 top-16 z-[1001] max-h-[40vh] overflow-y-auto rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-3 shadow-xl opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity"
      aria-label="Keyboard-navigable incident list"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Incidents ({reports.length})
      </p>
      <ul className="space-y-1">
        {reports.map((report) => {
          const isSelected = report.id === selectedReportId
          return (
            <li key={report.id}>
              <button
                type="button"
                data-report-id={report.id}
                onClick={() => {
                  onSelect(report.id)
                }}
                aria-pressed={isSelected}
                className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-[var(--color-info)]/20 text-[var(--color-info)]'
                    : 'text-[var(--color-text-primary)] hover:bg-white/10'
                }`}
                aria-label={`${report.type} incident, severity ${report.severity}, at ${report.municipality}, ${report.barangay}${isSelected ? ', selected' : ''}`}
              >
                <span className="font-medium">{report.municipality}</span>
                <span className="text-[var(--color-text-muted)]"> · {report.barangay}</span>
                <span
                  className="ml-1.5 inline-block rounded px-1 py-0.5 text-[10px] uppercase text-white"
                  style={{ backgroundColor: `var(--color-severity-${report.severity})` }}
                >
                  {report.severity}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
