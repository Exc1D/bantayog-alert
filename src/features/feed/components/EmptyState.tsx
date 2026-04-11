/**
 * EmptyState Component
 *
 * Displays when there are no reports in the feed.
 * Shows a friendly illustration with a call-to-action to report an incident.
 */

import { FileSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'

export function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4"
      data-testid="feed-empty-state"
    >
      {/* Icon illustration */}
      <div className="mb-6">
        <div
          className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center"
          data-testid="empty-state-icon"
        >
          <FileSearch className="w-12 h-12 text-gray-400" />
        </div>
      </div>

      {/* Main message */}
      <h2
        className="text-xl font-semibold text-gray-900 mb-2 text-center"
        data-testid="empty-state-title"
      >
        No reports yet
      </h2>

      {/* Description */}
      <p
        className="text-gray-600 text-center mb-8 max-w-sm"
        data-testid="empty-state-description"
      >
        Be the first to report an incident in your area!
      </p>

      {/* Call-to-action button */}
      <Link to="/report" data-testid="empty-state-cta-link">
        <Button variant="primary" data-testid="empty-state-cta-button">
          Report Incident
        </Button>
      </Link>
    </div>
  )
}
