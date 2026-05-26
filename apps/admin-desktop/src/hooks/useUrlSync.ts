import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, i) => val === b[i])
}

interface UrlSyncOptions {
  reportId?: string | null
  municipalityId?: string | null
  overlays?: string[]
  onReportIdChange?: (id: string | null) => void
  onMunicipalityIdChange?: (id: string | null) => void
  onOverlaysChange?: (overlays: string[]) => void
}

export function useUrlSync({
  reportId,
  municipalityId,
  overlays,
  onReportIdChange,
  onMunicipalityIdChange,
  onOverlaysChange,
}: UrlSyncOptions) {
  const [searchParams, setSearchParams] = useSearchParams()
  const lastReadRef = useRef('')

  // Read URL → state (reacts to external URL changes, e.g. bookmarks)
  useEffect(() => {
    const current = searchParams.toString()
    if (current === lastReadRef.current) return
    lastReadRef.current = current

    const urlReportId = searchParams.get('reportId')
    if (urlReportId && onReportIdChange && reportId !== urlReportId) {
      onReportIdChange(urlReportId)
    }

    const urlMunicipalityId = searchParams.get('municipalityId')
    if (urlMunicipalityId && onMunicipalityIdChange && municipalityId !== urlMunicipalityId) {
      onMunicipalityIdChange(urlMunicipalityId)
    }

    const urlOverlays = searchParams.getAll('overlay')
    if (onOverlaysChange && !arraysEqual(urlOverlays, overlays ?? [])) {
      onOverlaysChange(urlOverlays)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Write state → URL (only when state changes from user action)
  useEffect(() => {
    const next = new URLSearchParams(searchParams)

    if (reportId !== undefined) {
      if (reportId) {
        next.set('reportId', reportId)
      } else {
        next.delete('reportId')
      }
    }

    if (municipalityId !== undefined) {
      if (municipalityId) {
        next.set('municipalityId', municipalityId)
      } else {
        next.delete('municipalityId')
      }
    }

    if (overlays !== undefined) {
      next.delete('overlay')
      overlays.forEach((o) => {
        next.append('overlay', o)
      })
    }

    // Only update if params actually changed
    if (next.toString() !== searchParams.toString()) {
      lastReadRef.current = next.toString()
      setSearchParams(next)
    }
  }, [reportId, municipalityId, overlays, searchParams, setSearchParams])
}
