/**
 * MyReportsList Component
 *
 * Displays user's submitted reports:
 * - Registered reports (reporterUserId === userId)
 * - Linked anonymous reports (reporterPhone === user's phone)
 *
 * FIRESTORE INDEX REQUIREMENTS:
 * This component uses composite queries that require Firestore indexes.
 * Create the following indexes in Firebase Console > Firestore > Indexes:
 *
 * 1. Collection: report_private
 *    - Fields: reporterUserId (Ascending), reportId (Descending)
 *
 * 2. Collection: report_private
 *    - Fields: reporterPhone (Ascending), reportId (Descending)
 *
 * Or deploy firestore.indexes.json with:
 * {
 *   "indexes": [
 *     {
 *       "collectionGroup": "report_private",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "reporterUserId", "order": "ASCENDING" },
 *         { "fieldPath": "reportId", "order": "DESCENDING" }
 *       ]
 *     },
 *     {
 *       "collectionGroup": "report_private",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "reporterPhone", "order": "ASCENDING" },
 *         { "fieldPath": "reportId", "order": "DESCENDING" }
 *       ]
 *     }
 *   ]
 * }
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/app/firebase/config'
import { Button } from '@/shared/components/Button'
import { ReportStatus } from '@/shared/types/firestore.types'

export interface MyReportsListProps {
  userId: string
  userPhone?: string
}

interface ReportSummary {
  id: string
  incidentType: string
  status: ReportStatus
  createdAt: Date
  barangay: string
  municipality: string
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  resolved: 'Resolved',
  rejected: 'Rejected',
}

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function MyReportsList({ userId, userPhone }: MyReportsListProps) {
  const navigate = useNavigate()
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchReports() {
      setIsLoading(true)
      setError(null)

      try {
        const allReports: ReportSummary[] = []
        const seenIds = new Set<string>()

        // Fetch registered reports (reporterUserId === userId)
        if (userId) {
          const registeredQuery = query(
            collection(db, 'report_private'),
            where('reporterUserId', '==', userId),
            orderBy('reportId', 'desc')
          )
          const registeredSnap = await getDocs(registeredQuery)

          for (const docSnap of registeredSnap.docs) {
            const data = docSnap.data()
            if (!data) continue

            const reportId = data.reportId
            if (!reportId || seenIds.has(reportId)) continue

            seenIds.add(reportId)
            allReports.push({
              id: reportId,
              incidentType: data.incidentType || 'other',
              status: data.status || 'pending',
              createdAt: data.createdAt?.toDate() || new Date(),
              barangay: data.barangay || 'Unknown',
              municipality: data.municipality || 'Unknown',
            })
          }
        }

        // Fetch linked anonymous reports (reporterPhone === userPhone)
        if (userPhone) {
          const linkedQuery = query(
            collection(db, 'report_private'),
            where('reporterPhone', '==', userPhone),
            orderBy('reportId', 'desc')
          )
          const linkedSnap = await getDocs(linkedQuery)

          for (const docSnap of linkedSnap.docs) {
            const data = docSnap.data()
            if (!data) continue

            const reportId = data.reportId
            if (!reportId || seenIds.has(reportId)) continue

            seenIds.add(reportId)
            allReports.push({
              id: reportId,
              incidentType: data.incidentType || 'other',
              status: data.status || 'pending',
              createdAt: data.createdAt?.toDate() || new Date(),
              barangay: data.barangay || 'Unknown',
              municipality: data.municipality || 'Unknown',
            })
          }
        }

        // Sort by createdAt descending
        allReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        setReports(allReports)
      } catch (err: unknown) {
        console.error('Failed to fetch reports:', err)
        setError('Failed to load reports. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReports()
  }, [userId, userPhone])

  const renderLoading = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  )

  const renderError = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
      {error}
    </div>
  )

  const renderEmpty = () => (
    <div className="bg-gray-50 rounded-lg p-6 text-center">
      <p className="text-gray-500">No reports yet.</p>
      <p className="text-sm text-gray-400 mt-1">
        Submit a report or link your existing reports to see them here.
      </p>
    </div>
  )

  const renderReportList = (reportList: ReportSummary[], title: string) => {
    if (reportList.length === 0) return null
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
        {reportList.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 capitalize">{report.incidentType}</p>
                <StatusBadge status={report.status} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {report.createdAt.toLocaleDateString()} • {report.barangay}, {report.municipality}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/feed/${report.id}`)}
            >
              View
            </Button>
          </div>
        ))}
      </div>
    )
  }

  const renderReports = () => {
    const pending = reports.filter((r) => r.status === 'pending')
    const verified = reports.filter((r) => r.status === 'verified')
    const resolved = reports.filter((r) => r.status === 'resolved')
    const rejected = reports.filter((r) => r.status === 'rejected')

    return (
      <div className="space-y-6">
        {renderReportList(pending, 'Pending')}
        {renderReportList(verified, 'Verified')}
        {renderReportList(resolved, 'Resolved')}
        {renderReportList(rejected, 'Rejected')}
      </div>
    )
  }

  return (
    <div data-testid="reports-tab">
      {isLoading && renderLoading()}
      {error && renderError()}
      {!isLoading && !error && reports.length === 0 && renderEmpty()}
      {!isLoading && !error && reports.length > 0 && renderReports()}
    </div>
  )
}
