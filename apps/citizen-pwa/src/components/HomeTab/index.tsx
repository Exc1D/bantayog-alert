import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const MODULE_SLOTS = [
  { label: 'Your local brief', height: 'min-h-40' },
  { label: 'Your report', height: 'min-h-28' },
  { label: 'Nearby', height: 'min-h-28' },
  { label: "Today's weather", height: 'min-h-24' },
] as const

export function HomeTab() {
  const navigate = useNavigate()

  return (
    <div data-testid="home-tab" className="h-full overflow-y-auto bg-surface-50">
      <div className="mx-auto w-full max-w-lg" aria-busy="true" aria-label="Home content loading">
        <header className="border-b border-surface-200 px-5 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="h-6 w-44 rounded-md bg-surface-200" />
            <button
              type="button"
              aria-label="Open alerts"
              data-alert-badge-host
              onClick={() => void navigate('/alerts')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-surface-700 active:bg-surface-100"
            >
              <Bell size={22} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 h-4 w-56 rounded bg-surface-200" />
          <div className="mt-2 h-3 w-32 rounded bg-surface-200" />
        </header>

        {MODULE_SLOTS.map(({ label, height }) => (
          <section
            key={label}
            data-home-slot={label}
            className={`${height} border-b border-surface-200 px-5 py-5`}
          >
            <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-surface-600">
              {label}
            </p>
            <div className="mt-4 h-4 w-4/5 rounded bg-surface-200" />
            <div className="mt-2 h-4 w-3/5 rounded bg-surface-200" />
          </section>
        ))}

        <section data-home-slot="Emergency contacts" className="px-5 py-5">
          <p className="m-0 text-sm font-semibold text-surface-600">Emergency contacts</p>
        </section>
      </div>
    </div>
  )
}
