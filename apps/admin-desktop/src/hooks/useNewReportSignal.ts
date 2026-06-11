import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { useAudioAlerts } from './useAudioAlerts'
import type { ReportDoc } from './useFirestoreListeners'

const BASE_TITLE = 'Bantayog Command'
const REPORT_SNAPSHOT_EVENT = 'bantayog:admin-report-snapshot'
const noop = () => undefined

type ReportTimestamp = number | string | { toDate(): Date }
type NewReportSignalReport = Pick<ReportDoc, 'id' | 'status' | 'createdAt' | 'submittedAt'>

interface ReportSnapshotDetail {
  reports: readonly NewReportSignalReport[]
}

interface NewReportSignalState {
  notificationCount: number
  audioEnabled: boolean
  toggleAudio: () => void
}

const DEFAULT_SIGNAL_STATE: NewReportSignalState = {
  notificationCount: 0,
  audioEnabled: false,
  toggleAudio: noop,
}

const NewReportSignalContext = createContext<NewReportSignalState>(DEFAULT_SIGNAL_STATE)

function toMillis(value: ReportTimestamp | undefined): number | null {
  if (value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  try {
    const date = value.toDate()
    const millis = date.getTime()
    return Number.isFinite(millis) ? millis : null
  } catch (err: unknown) {
    console.warn('[toMillis] toDate() threw:', err)
    return null
  }
}

function reportCreatedAtMillis(report: NewReportSignalReport): number | null {
  return toMillis(report.createdAt ?? report.submittedAt)
}

function isNewAfterWatermark(report: NewReportSignalReport, watermark: number): boolean {
  const createdAt = reportCreatedAtMillis(report)
  return report.status === 'new' && createdAt !== null && createdAt > watermark
}

function latestNewReportMillis(reports: readonly NewReportSignalReport[]): number | null {
  const createdAtValues = reports
    .filter((report) => report.status === 'new')
    .map(reportCreatedAtMillis)
    .filter((value): value is number => value !== null)
  if (createdAtValues.length === 0) return null
  return Math.max(...createdAtValues)
}

function isReportSnapshotEvent(event: Event): event is CustomEvent<ReportSnapshotDetail> {
  const detail = (event as CustomEvent<unknown>).detail
  return (
    typeof detail === 'object' &&
    detail !== null &&
    'reports' in detail &&
    Array.isArray((detail as ReportSnapshotDetail).reports)
  )
}

export function publishReportSnapshot(reports: readonly NewReportSignalReport[]): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<ReportSnapshotDetail>(REPORT_SNAPSHOT_EVENT, {
      detail: { reports },
    }),
  )
}

export function NewReportSignalProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { enabled: audioEnabled, play, toggle } = useAudioAlerts()
  const [notificationCount, setNotificationCount] = useState(0)
  const reportsRef = useRef<readonly NewReportSignalReport[]>([])
  const watermarkRef = useRef<number | null>(null)
  const alertedReportIdsRef = useRef(new Set<string>())
  const isTriageRouteRef = useRef(location.pathname === '/triage')

  const clearSignal = useCallback(() => {
    const latestReportMillis = latestNewReportMillis(reportsRef.current) ?? 0
    watermarkRef.current = Math.max(watermarkRef.current ?? 0, Date.now(), latestReportMillis)
    alertedReportIdsRef.current.clear()
    setNotificationCount(0)
  }, [])

  const processReports = useCallback(
    (reports: readonly NewReportSignalReport[]) => {
      reportsRef.current = reports
      if (isTriageRouteRef.current) {
        clearSignal()
        return
      }

      watermarkRef.current ??= Date.now()
      const matchingReports = reports.filter((report) =>
        isNewAfterWatermark(report, watermarkRef.current ?? 0),
      )
      const newlyObservedReports = matchingReports.filter(
        (report) => !alertedReportIdsRef.current.has(report.id),
      )

      if (newlyObservedReports.length > 0) {
        for (const report of newlyObservedReports) {
          alertedReportIdsRef.current.add(report.id)
        }
        play()
      }

      setNotificationCount(matchingReports.length)
    },
    [clearSignal, play],
  )

  useEffect(() => {
    watermarkRef.current ??= Date.now()
  }, [])

  useEffect(() => {
    isTriageRouteRef.current = location.pathname === '/triage'
    if (isTriageRouteRef.current) clearSignal()
  }, [clearSignal, location.pathname])

  useEffect(() => {
    const handleSnapshot = (event: Event) => {
      if (!isReportSnapshotEvent(event)) return
      processReports(event.detail.reports)
    }

    window.addEventListener(REPORT_SNAPSHOT_EVENT, handleSnapshot)
    return () => {
      window.removeEventListener(REPORT_SNAPSHOT_EVENT, handleSnapshot)
    }
  }, [processReports])

  useEffect(() => {
    const previousTitle = document.title
    document.title =
      notificationCount > 0 ? `(${String(notificationCount)}) ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = previousTitle
    }
  }, [notificationCount])

  const value = useMemo<NewReportSignalState>(
    () => ({
      notificationCount,
      audioEnabled,
      toggleAudio: toggle,
    }),
    [audioEnabled, notificationCount, toggle],
  )

  return createElement(NewReportSignalContext.Provider, { value }, children)
}

export function useNewReportSignal(): NewReportSignalState {
  return useContext(NewReportSignalContext)
}
