import { MapPin } from 'lucide-react'
import {
  incidentIcon,
  incidentLabel,
  statusMeta,
  severityDotColor,
} from '../../../utils/incident-meta.js'
import type { MyReport } from '../../MapTab/types.js'
import { timeAgo } from '../../../lib/time-ago.js'

interface ReportCardProps {
  report: MyReport
  onTap: () => void
  onWithdraw?: () => void
}

export function ReportCard({ report, onTap, onWithdraw }: ReportCardProps) {
  const icon = incidentIcon(report.reportType)
  const label = incidentLabel(report.reportType)
  const { label: statusLabel, bg, color } = statusMeta(report.status)
  const dot = severityDotColor(report.severity)

  return (
    <article className="w-full text-left cursor-pointer bg-white rounded-xl p-3.5 mb-2 border border-surface-200 shadow-sm active:scale-[0.99] transition-transform">
      <div className="flex gap-2.5 items-start">
        <span aria-hidden="true" className="shrink-0 leading-snug flex items-center">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full shrink-0 inline-block"
                style={{ background: dot }}
              />
              <p className="m-0 font-bold text-[0.9375rem] text-surface-900">{label}</p>
            </div>
            <span className="shrink-0 text-[0.6875rem] text-surface-400">
              {timeAgo(report.submittedAt)}
            </span>
          </div>
          {report.municipalityLabel ? (
            <p className="mt-[3px] mb-1.5 text-[0.8125rem] text-surface-600">
              <MapPin size={12} className="inline align-middle" /> {report.municipalityLabel}
            </p>
          ) : null}
          <div className="flex gap-1.5 items-center mt-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold tracking-wide ${bg} ${color}`}
            >
              {statusLabel}
            </span>
            <span className="text-[0.6875rem] text-surface-400">Ref: {report.publicRef}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {onWithdraw && (
              <button
                type="button"
                onClick={onWithdraw}
                className="min-h-9 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 text-xs font-bold text-danger-600"
                aria-label={`Withdraw report ${report.publicRef}`}
              >
                Withdraw
              </button>
            )}
            <button
              type="button"
              onClick={onTap}
              className="ml-auto min-h-9 rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-bold text-brand-600"
            >
              Track
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
