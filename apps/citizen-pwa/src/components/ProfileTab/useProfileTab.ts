import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { Award, ShieldCheck, HeartHandshake, MapPin } from 'lucide-react'
import { useMyActiveReports } from '../../hooks/useMyActiveReports'
import { cancelReport } from '../../services/callables'
import { deleteReport } from '../../services/localForageReports'
import { useToast } from '../../hooks/useToast'
import { auth, hasFirebaseConfig } from '../../services/firebase'
import type { MyReport } from '../MapTab/types.js'

function timeAgo(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

export interface ProfileTabState {
  user: User | null
  authLoading: boolean
  reports: MyReport[]
  loading: boolean
  reportsError: string | null
  retryReports: () => void
  withdrawReport: MyReport | null
  signOutError: boolean
  daysAsGuardian: number
  isPseudonymous: boolean
  isRegistered: boolean
  initials: string
  verifiedCount: number
  resolvedCount: number
  uniqueAreas: number
  badges: ReturnType<typeof useBadges>
  timeAgo: (ts: number) => string
  setWithdrawReport: (report: MyReport | null) => void
  handleSignOut: () => Promise<void>
  handleShare: () => Promise<void>
  handleWithdrawReport: (report: MyReport) => Promise<void>
}

export function useProfileTab(): ProfileTabState {
  const navigate = useNavigate()
  const { reports, loading, error: reportsError, retry: retryReports } = useMyActiveReports()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(() => hasFirebaseConfig())
  const [withdrawReport, setWithdrawReport] = useState<MyReport | null>(null)
  const [signOutError, setSignOutError] = useState(false)

  useEffect(() => {
    if (!hasFirebaseConfig()) return
    const unsub = onAuthStateChanged(auth(), (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const isPseudonymous = user?.isAnonymous === true
  const isRegistered = user !== null && !user.isAnonymous

  const verifiedCount = reports.filter((r) => r.status === 'verified').length
  const initials =
    isRegistered && user.displayName ? user.displayName.slice(0, 2).toUpperCase() : ''

  const resolvedCount = reports.filter(
    (r) => r.status === 'resolved' || r.status === 'closed',
  ).length
  const uniqueAreas = new Set(reports.map((r) => r.municipalityLabel).filter(Boolean)).size

  const [daysAsGuardian, setDaysAsGuardian] = useState(0)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (reports.length === 0) {
      setDaysAsGuardian(0)
      return
    }
    const minTs = reports.reduce((min, r) => Math.min(min, r.submittedAt), Infinity)
    setDaysAsGuardian(Math.max(1, Math.floor((Date.now() - minTs) / 86400000)))
  }, [reports])
  /* eslint-enable react-hooks/set-state-in-effect */

  const badges = useBadges(reports)

  const handleSignOut = async () => {
    setSignOutError(false)
    try {
      await signOut(auth())
      void navigate('/', { replace: true })
    } catch {
      setSignOutError(true)
    }
  }

  const handleShare = async () => {
    const text = `I've helped keep my community safe by filing ${String(reports.length)} ${reports.length === 1 ? 'report' : 'reports'} on Bantayog Alert.`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text, url: window.location.origin })
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      // user cancelled or API unavailable
    }
  }

  const handleWithdrawReport = async (report: MyReport) => {
    if (report.id) {
      try {
        await cancelReport(report.id)
        toast('Report withdrawn', 'success')
      } catch {
        toast('Failed to withdraw report', 'error')
        return
      }
    }
    try {
      await deleteReport(report.publicRef)
    } catch (err: unknown) {
      console.warn('Failed to cleanup local report cache after withdraw', err)
    }
    setWithdrawReport(null)
  }

  return {
    user,
    authLoading,
    reports,
    loading,
    reportsError,
    retryReports,
    withdrawReport,
    signOutError,
    daysAsGuardian,
    isPseudonymous,
    isRegistered,
    initials,
    verifiedCount,
    resolvedCount,
    uniqueAreas,
    badges,
    timeAgo,
    setWithdrawReport,
    handleSignOut,
    handleShare,
    handleWithdrawReport,
  }
}

/* ── Badge system ── */
interface BadgeDef {
  id: string
  label: string
  description: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  earned: boolean
}

const BADGE_DEFS: Omit<BadgeDef, 'earned'>[] = [
  {
    id: 'first-report',
    label: 'First Report',
    description: 'You started helping your community',
    Icon: Award,
  },
  {
    id: 'verified-reporter',
    label: 'Verified Reporter',
    description: 'A report you filed was verified',
    Icon: ShieldCheck,
  },
  {
    id: 'community-helper',
    label: 'Community Helper',
    description: 'Reports added community context',
    Icon: HeartHandshake,
  },
  {
    id: 'active-citizen',
    label: 'Local Signal',
    description: 'Reports helped map local risk',
    Icon: MapPin,
  },
]

function useBadges(reports: MyReport[]): BadgeDef[] {
  const count = reports.length
  const verifiedCount = reports.filter((r) => r.status === 'verified').length
  return useMemo(
    () =>
      BADGE_DEFS.map((def) => ({
        ...def,
        earned:
          def.id === 'first-report'
            ? count >= 1
            : def.id === 'verified-reporter'
              ? verifiedCount >= 1
              : def.id === 'community-helper'
                ? count >= 3
                : count >= 5,
      })),
    [count, verifiedCount],
  )
}

export { useBadges }
export type { BadgeDef }
