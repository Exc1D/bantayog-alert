import { useUIStore } from '../lib/store'
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
  const closeSheet = useUIStore((state) => state.closeSheet)

  const variants = {
    success: {
      icon: '✓',
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
      icon: '⏳',
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
      icon: '⚠',
      headline: "We couldn't send it yet.",
      subline:
        'Your report is safe on your phone. The network is having trouble reaching MDRRMO — this is not your fault. If this is life-threatening, please call now.',
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
      closeSheet()
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
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        role="button"
        tabIndex={0}
        onClick={state === 'success' ? onClose : undefined}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && state === 'success') onClose?.()
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pointer-events-auto shadow-2xl">
        <div className="w-12 h-1 bg-[#d1d5db] rounded-full mx-auto mb-3.5" />

        <StatusBanner variant={variant.bannerVariant} icon={variant.icon}>
          {variant.headline}
        </StatusBanner>

        <p className="text-center text-sm text-[#52606d] mb-4">{variant.subline}</p>

        <div
          className={`bg-gradient-to-b from-[#fff5ef] to-[#ffeee6] border border-[#f5d4bb] rounded-xl p-3.5 text-center mb-4 ${
            state === 'queued'
              ? 'from-[#fef9e7] to-[#fef3c7] border-[#f3d57b]'
              : state === 'failed_retryable'
                ? 'from-[#fff5f5] to-[#fee2e2] border-[#f5a8a8]'
                : ''
          }`}
        >
          <div className="text-[10px] font-bold text-[#7b8794] uppercase tracking-wider mb-1">
            {state === 'queued' ? 'Draft reference' : 'Reference'}
          </div>
          <div className="font-mono text-lg font-bold text-[#001e40]">{referenceCode}</div>
          <div className="text-[11px] text-[#52606d]">
            {state === 'success'
              ? `Submitted ${new Date().toLocaleTimeString()}`
              : state === 'queued'
                ? 'Will become final on send'
                : 'Nothing is lost'}
          </div>
        </div>

        {variant.receiverText && (
          <div className="flex items-center gap-2.5 p-3 bg-[#f5f7fa] rounded-lg mb-4">
            <div
              className={`w-2 h-2 rounded-full ${
                state === 'queued' ? 'bg-[#f59e0b] animate-pulse' : 'bg-[#16a34a]'
              }`}
            />
            <span className="text-sm font-medium text-[#001e40]">{variant.receiverText}</span>
          </div>
        )}

        <Timeline events={timelineEvents[state]} />

        {state !== 'success' && (
          <FallbackCards
            hotlineNumber={HOTLINE_NUMBER}
            emphasized={state === 'failed_retryable'}
            onCallClick={handleCallHotline}
            onSmsClick={handleSmsFallback}
          />
        )}

        {state === 'success' && (
          <FallbackCards hotlineNumber={HOTLINE_NUMBER} onCallClick={handleCallHotline} />
        )}

        <Button variant={variant.primaryVariant} fullWidth onClick={handlePrimaryAction}>
          {variant.primaryButton}
        </Button>

        {variant.secondaryButton && (
          <Button variant="secondary" fullWidth className="mt-2" onClick={onClose}>
            {variant.secondaryButton}
          </Button>
        )}

        <p className="text-center text-xs text-[#7b8794] mt-3">{variant.permissionText}</p>
      </div>
    </div>
  )
}
