const SEVERITY_FILTERS = [
  { value: 'all', label: 'All severities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const

const SELECT_CLASS =
  'mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]'
const LABEL_CLASS = 'text-xs font-semibold uppercase text-[var(--color-text-muted)]'

function filterLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export interface TriageFilterValues {
  status: string
  severity: string
  type: string
  search: string
}

interface Props {
  values: TriageFilterValues
  statusOptions: readonly { value: string; label: string }[]
  typeOptions: readonly string[]
  onChange: (patch: Partial<TriageFilterValues>) => void
  onClear: () => void
}

export function TriageFilters({ values, statusOptions, typeOptions, onChange, onClear }: Props) {
  return (
    <section
      aria-label="Triage filters"
      className="grid gap-3 rounded border border-white/10 bg-[var(--color-surface-elevated)] p-4 md:grid-cols-6"
    >
      <label className={LABEL_CLASS}>
        Status filter
        <select
          value={values.status}
          onChange={(event) => {
            onChange({ status: event.target.value })
          }}
          className={SELECT_CLASS}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL_CLASS}>
        Severity filter
        <select
          value={values.severity}
          onChange={(event) => {
            onChange({ severity: event.target.value })
          }}
          className={SELECT_CLASS}
        >
          {SEVERITY_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL_CLASS}>
        Type filter
        <select
          value={values.type}
          onChange={(event) => {
            onChange({ type: event.target.value })
          }}
          className={SELECT_CLASS}
        >
          <option value="all">All types</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {filterLabel(type)}
            </option>
          ))}
        </select>
      </label>
      <div className={`${LABEL_CLASS} md:col-span-2`}>
        <label htmlFor="triage-search">Search triage reports</label>
        <div className="mt-1 flex gap-2">
          <input
            id="triage-search"
            type="search"
            value={values.search}
            onChange={(event) => {
              onChange({ search: event.target.value })
            }}
            className="min-w-0 flex-1 rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
            placeholder="Search summary, place, type, or report ID"
          />
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-white/10 px-3 py-2 text-sm font-medium normal-case text-[var(--color-text-secondary)] hover:bg-white/10"
          >
            Clear filters
          </button>
        </div>
      </div>
    </section>
  )
}
