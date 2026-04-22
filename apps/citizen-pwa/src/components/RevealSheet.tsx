import { Check, Clock, AlertTriangle } from 'lucide-react'
import { StatusBanner } from './ui/StatusBanner'
import { Button } from './ui/Button'
import { FallbackCards } from './ui/FallbackCards'
import { Timeline } from './ui/Timeline'

const HOTLINE_NUMBER = '(054) 721-1216'

interface RevealSheetProps {
  state: 'success' | 'queued' | 'failed_retryable'
  referenceCode: string
  onClose?: () => void
}

export function RevealSheet({ state, referenceCode, onClose }: RevealSheetProps) {
  const variants = {
    success: {
      icon: <Check size={16} />,
      headline: 'We heard you. We are here.',
      subline: 'Your report is with Daet MDRRMO. Keep your line open.',
      bannerVariant: 'success' as const,
      receiverText: 'Received by Daet MDRRMO',
      primaryButton: 'Track this report',
      primaryVariant: 'primary' as const,
      secondaryButton: undefined,
      permissionText: "You can close this app. We'll text you.",
    },
    queued: {
      icon: <Clock size={16} />,
      headline: "We've saved your report.",
      subline:
        "You're offline right now. The moment your phone reconnects, we'll send this to Daet MDRRMO automatically. Walang mawawala. Safe ito sa phone mo.",
      bannerVariant: 'queued' as const,
      receiverText: 'Waiting for signal · auto-retry on',
      primaryButton: 'Try sending now',
      primaryVariant: 'amber' as const,
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll keep trying in the background.",
    },
    failed_retryable: {
      icon: <AlertTriangle size={16} />,
      headline: "We couldn't send it yet.",
      subline:
        'Your report is safe on your phone. The network is having trouble reaching the Admins — this is not your fault. If this is life-threatening, please call now.',
      bannerVariant: 'failed' as const,
      receiverText: undefined,
      primaryButton: 'Try again',
      primaryVariant: 'red' as const,
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll hold this draft for 24 hours.",
    },
  }

  const variant = variants[state]

  const handleTrackReport = () => {
    window.location.href = `/reports/${referenceCode}`
  }

  const handlePrimaryAction = () => {
    if (state === 'success') {
      handleTrackReport()
    } else {
      onClose?.()
    }
  }

  const handleCallHotline = () => {
    window.location.href = 'tel:0547211216'
  }

  const handleSmsFallback = () => {
    window.location.href = `sms:2933?body=${encodeURIComponent(`BANTAYOG ${referenceCode}\n[Incident details here]`)}`
  }

  const timelineEvents = {
    success: [
      { label: 'Report received', meta: '2:14 PM', state: 'complete' as const },
      { label: 'First review', meta: 'Expected within 15 min', state: 'pending' as const },
      {
        label: 'Responder dispatched',
        meta: "We'll text and update here",
        state: 'pending' as const,
      },
    ],
    queued: [
      { label: 'Saved on this phone', meta: '2:14 PM', state: 'queued' as const },
      {
        label: 'Send when online',
        meta: 'Automatic · no action needed',
        state: 'pending' as const,
      },
      {
        label: 'Received by MDRRMO',
        meta: "We'll text you the reference",
        state: 'pending' as const,
      },
    ],
    failed_retryable: [
      { label: 'Report drafted', meta: '2:14 PM', state: 'complete' as const },
      {
        label: 'Send attempt failed',
        meta: 'Network error · you can retry',
        state: 'failed' as const,
      },
      { label: 'Retry send', meta: 'Try again or call the hotline', state: 'pending' as const },
    ],
  }

  return (
    <div className="reveal-overlay">
      <div
        className="reveal-backdrop"
        role="button"
        tabIndex={0}
        onClick={state === 'success' ? onClose : undefined}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && state === 'success') onClose?.()
        }}
      />
      <div className="reveal-sheet">
        <div className="reveal-handle" />

        <StatusBanner variant={variant.bannerVariant} icon={variant.icon}>
          {variant.headline}
        </StatusBanner>

        <p className="reveal-subheadline">{variant.subline}</p>

        <div
          className={`reveal-ref-box${state === 'queued' ? ' reveal-ref-box--queued' : state === 'failed_retryable' ? ' reveal-ref-box--failed' : ''}`}
        >
          <div className="reveal-ref-label">
            {state === 'queued' ? 'Draft reference' : 'Reference'}
          </div>
          <div className="reveal-ref-code">{referenceCode}</div>
          <div className="reveal-ref-note">
            {state === 'success'
              ? `Submitted ${new Date().toLocaleTimeString()}`
              : state === 'queued'
                ? 'Will become final on send'
                : 'Nothing is lost'}
          </div>
        </div>

        {variant.receiverText ? (
          <div className="reveal-receiver">
            <div
              className={`reveal-receiver-dot reveal-receiver-dot--${state === 'queued' ? 'queued' : 'success'}`}
            />
            <span className="reveal-receiver-text">{variant.receiverText}</span>
          </div>
        ) : null}

        <Timeline events={timelineEvents[state]} />

        {state !== 'success' ? (
          <FallbackCards
            hotlineNumber={HOTLINE_NUMBER}
            emphasized={state === 'failed_retryable'}
            onCallClick={handleCallHotline}
            onSmsClick={handleSmsFallback}
          />
        ) : (
          <FallbackCards hotlineNumber={HOTLINE_NUMBER} onCallClick={handleCallHotline} />
        )}

        <Button variant={variant.primaryVariant} fullWidth onClick={handlePrimaryAction}>
          {variant.primaryButton}
        </Button>

        {variant.secondaryButton ? (
          <div className="reveal-secondary-btn">
            <Button variant="secondary" fullWidth onClick={onClose}>
              {variant.secondaryButton}
            </Button>
          </div>
        ) : null}

        <p className="reveal-footer">{variant.permissionText}</p>
      </div>
    </div>
  )
}
