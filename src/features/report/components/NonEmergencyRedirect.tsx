/**
 * NonEmergencyRedirect Component
 *
 * Shown when a user indicates their report is NOT an emergency.
 * Displays municipal contact information for non-emergency issues
 * like potholes, broken street lights, etc.
 */

import { Building2, AlertTriangle, Users, Phone } from 'lucide-react'
import { Button } from '@/shared/components/Button'

export interface NonEmergencyRedirectProps {
  municipality: string
  municipalHallPhone?: string
  mdrmoPhone?: string
  barangayCaptainPhone?: string
  onCancel?: () => void
}

export function NonEmergencyRedirect({
  municipality,
  municipalHallPhone,
  mdrmoPhone,
  barangayCaptainPhone,
  onCancel,
}: NonEmergencyRedirectProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-8 text-center">
      <div className="mb-6">
        <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          This isn&apos;t an emergency?
        </h1>
        <p className="text-gray-600">
          For non-emergency issues, contact the appropriate office directly:
        </p>
      </div>

      <div className="w-full max-w-md space-y-4 mb-8">
        {municipalHallPhone && (
          <a
            href={`tel:${municipalHallPhone}`}
            className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border hover:border-primary-blue transition-colors"
          >
            <Building2 className="w-5 h-5 text-gray-500" />
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900">Municipal Hall</p>
              <p className="text-sm text-gray-500">{municipality}</p>
            </div>
            <Phone className="w-5 h-5 text-primary-blue" />
          </a>
        )}

        {mdrmoPhone && (
          <a
            href={`tel:${mdrmoPhone}`}
            className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border hover:border-primary-blue transition-colors"
          >
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900">MDRRMO Office</p>
              <p className="text-sm text-gray-500">Emergency Management</p>
            </div>
            <Phone className="w-5 h-5 text-primary-blue" />
          </a>
        )}

        {barangayCaptainPhone && (
          <a
            href={`tel:${barangayCaptainPhone}`}
            className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border hover:border-primary-blue transition-colors"
          >
            <Users className="w-5 h-5 text-green-500" />
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900">Barangay Captain</p>
              <p className="text-sm text-gray-500">Your local barangay</p>
            </div>
            <Phone className="w-5 h-5 text-primary-blue" />
          </a>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Go back
        </Button>
      </div>
    </div>
  )
}
