/**
 * LinkReportsByPhone Component
 *
 * Allows anonymous users to link their past reports by entering
 * the phone number used during submission.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Search, CheckCircle, AlertCircle } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/app/firebase/config'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'

export interface LinkReportsByPhoneProps {
  onSuccess?: (count: number) => void
  onCreateAccount?: () => void
}

interface FoundReport {
  id: string
  incidentType: string
  createdAt: Date
  status: string
}

export function LinkReportsByPhone({ onSuccess, onCreateAccount }: LinkReportsByPhoneProps) {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [foundReports, setFoundReports] = useState<FoundReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validatePhone = (value: string): boolean => {
    const phRegex = /^(\+?63|0)?[0-9]{10}$/
    return phRegex.test(value.replace(/\s/g, ''))
  }

  const handleSearch = async () => {
    if (!validatePhone(phone)) {
      setError('Please enter a valid Philippine phone number')
      return
    }

    setIsSearching(true)
    setError(null)
    setFoundReports(null)

    try {
      const reportsRef = collection(db, 'report_private')
      const q = query(reportsRef, where('reporterPhone', '==', phone))
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        setFoundReports([])
      } else {
        const publicReports: FoundReport[] = []
        for (const doc of snapshot.docs) {
          const data = doc.data()
          publicReports.push({
            id: doc.id,
            incidentType: data.incidentType || 'unknown',
            createdAt: data.createdAt?.toDate() || new Date(),
            status: data.status || 'pending',
          })
        }
        setFoundReports(publicReports)
        onSuccess?.(publicReports.length)
      }
    } catch (err: unknown) {
      console.error('Failed to search reports:', err)
      setError('Failed to search. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleCreateAccount = () => {
    if (onCreateAccount) {
      onCreateAccount()
    } else {
      navigate(`/signup?phone=${encodeURIComponent(phone)}`)
    }
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Phone className="w-6 h-6 text-primary-blue" />
        <div>
          <h2 className="font-bold text-gray-900">Link your past reports</h2>
          <p className="text-sm text-gray-500">
            Enter the phone number you used to submit reports
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Input
          label="Phone number"
          type="tel"
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+63 912 345 6789"
          error={error || undefined}
        />

        <Button
          onClick={handleSearch}
          disabled={isSearching || !phone}
          className="w-full"
        >
          <Search className="w-4 h-4 mr-2" />
          {isSearching ? 'Searching...' : 'Link Reports'}
        </Button>
      </div>

      {foundReports !== null && (
        <div className="mt-6">
          {foundReports.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-gray-400" />
              <p className="text-gray-600">No reports found for this phone number.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  Found {foundReports.length} report{foundReports.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {foundReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {report.incidentType}
                      </p>
                      <p className="text-xs text-gray-500">
                        {report.createdAt.toLocaleDateString()} • {report.status}
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

              {/* Post-link registration prompt */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-900 mb-3">
                  Create an account to track these reports and receive updates.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateAccount}
                  className="w-full"
                >
                  Create Account
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
