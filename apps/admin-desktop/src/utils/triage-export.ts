import type { Report } from '../types'

function csvCell(value: string | number): string {
  let text = String(value)
  // Prefix formula-leading characters so spreadsheets don't execute them (CSV injection).
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

export function buildTriageExportCsv(reports: readonly Report[]): string {
  const rows = [
    [
      'reportId',
      'type',
      'severity',
      'status',
      'municipality',
      'barangay',
      'description',
      'createdAt',
    ],
    ...reports.map((report) => [
      report.id,
      report.type,
      report.severity,
      report.status,
      report.municipality,
      report.barangay,
      report.description,
      report.createdAt,
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
