interface StatusRightProps {
  stalledDispatchCount: number
  totalResponders: number
  uncoveredMunicipalities: number
}

export function StatusRight({
  stalledDispatchCount,
  totalResponders,
  uncoveredMunicipalities,
}: StatusRightProps) {
  return (
    <div className="flex flex-1 items-center justify-end gap-6">
      {stalledDispatchCount > 0 && (
        <div className="flex flex-col items-end" data-testid="blocking-response">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Blocking
          </span>
          <span className="mt-1 text-sm font-semibold text-[var(--color-danger)]">
            {stalledDispatchCount} stalled dispatch{stalledDispatchCount === 1 ? '' : 'es'}
          </span>
        </div>
      )}
      <div className="flex flex-col items-end" data-testid="responder-coverage">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Coverage
        </span>
        <span className="mt-1 text-sm text-[var(--color-text-primary)]">
          {totalResponders} available / {uncoveredMunicipalities} uncovered
        </span>
      </div>
    </div>
  )
}
