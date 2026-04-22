import { Phone, MessageSquare } from 'lucide-react'

interface FallbackCardsProps {
  hotlineNumber: string
  emphasized?: boolean
  onCallClick?: () => void
  onSmsClick?: () => void
}

export function FallbackCards({
  hotlineNumber,
  emphasized = false,
  onCallClick,
  onSmsClick,
}: FallbackCardsProps) {
  return (
    <div className="fallback-grid">
      <button
        type="button"
        onClick={onCallClick}
        aria-label="Call hotline"
        className={`fallback-card${emphasized ? ' fallback-card--emphasized' : ''}`}
      >
        <div className="fallback-icon" aria-hidden="true">
          <Phone size={16} />
        </div>
        <div className="fallback-action">Call</div>
        <div className="fallback-detail">{hotlineNumber}</div>
      </button>
      <button
        type="button"
        onClick={onSmsClick}
        aria-label="Send SMS"
        className={`fallback-card${emphasized ? ' fallback-card--emphasized' : ''}`}
      >
        <div className="fallback-icon" aria-hidden="true">
          <MessageSquare size={16} />
        </div>
        <div className="fallback-action">SMS</div>
        <div className="fallback-detail">No data needed</div>
      </button>
    </div>
  )
}
