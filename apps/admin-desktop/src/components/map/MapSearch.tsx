import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, X, Filter } from 'lucide-react'
import type { Report } from '@/types'

interface MapSearchProps {
  incidents: Report[]
  searchQuery: string
  onSearchChange: (q: string) => void
  severityFilter: string[]
  onSeverityToggle: (s: string) => void
  typeFilter: string[]
  onTypeToggle: (t: string) => void
  onClearFilters: () => void
}

const severities = ['HIGH', 'MEDIUM', 'LOW']
const types = ['FLOOD', 'FIRE', 'LANDSLIDE', 'ACCIDENT', 'MEDICAL', 'OTHER']

export function MapSearch({
  incidents,
  searchQuery,
  onSearchChange,
  severityFilter,
  onSeverityToggle,
  typeFilter,
  onTypeToggle,
  onClearFilters,
}: MapSearchProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return incidents
      .filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.barangay.toLowerCase().includes(q) ||
          i.municipality.toLowerCase().includes(q) ||
          i.type.toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [searchQuery, incidents])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const hasFilters = severityFilter.length > 0 || typeFilter.length > 0

  return (
    <div
      ref={containerRef}
      className="absolute top-6 left-6 z-[500] flex flex-col gap-2 min-w-[280px]"
    >
      <div className="bg-white border border-border rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center px-3 py-2.5 gap-2">
          <Search className="w-4 h-4 text-muted-foreground/70 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value)
              setDropdownOpen(true)
            }}
            onFocus={() => {
              setDropdownOpen(true)
            }}
            placeholder="Search incidents, barangays, municipalities..."
            className="bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 outline-none flex-1 min-w-0"
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange('')
                setDropdownOpen(false)
              }}
              className="text-muted-foreground/70 hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              setShowFilters(!showFilters)
            }}
            className={`text-muted-foreground/70 hover:text-foreground transition-colors ${hasFilters ? 'text-accent' : ''}`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {dropdownOpen && results.length > 0 && (
          <div className="border-t border-border max-h-[240px] overflow-y-auto">
            {results.map((incident) => (
              <button
                key={incident.id}
                onClick={() => {
                  onSearchChange(incident.id)
                  setDropdownOpen(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-0"
              >
                <div className="text-sm font-mono text-accent font-medium">#{incident.id}</div>
                <div className="text-xs text-muted-foreground">
                  {incident.type} · {incident.barangay}, {incident.municipality}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showFilters && (
        <div className="bg-white border border-border rounded-lg shadow-lg p-3 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Severity
            </div>
            <div className="flex gap-2 flex-wrap">
              {severities.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onSeverityToggle(s)
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    severityFilter.includes(s)
                      ? s === 'HIGH'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : s === 'MEDIUM'
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-muted border-border text-muted-foreground/70'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Type</div>
            <div className="flex gap-2 flex-wrap">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onTypeToggle(t)
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    typeFilter.includes(t)
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-muted border-border text-muted-foreground/70'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {severityFilter.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs border border-accent/30"
                >
                  {s}
                  <button
                    onClick={() => {
                      onSeverityToggle(s)
                    }}
                    className="hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {typeFilter.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs border border-accent/30"
                >
                  {t}
                  <button
                    onClick={() => {
                      onTypeToggle(t)
                    }}
                    className="hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={onClearFilters}
                className="text-xs text-accent hover:underline ml-auto"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
