import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ShieldCheck, Save } from 'lucide-react'
import { onAuthStateChanged } from 'firebase/auth'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'
import { useSlotMachine } from '../../hooks/useSlotMachine.js'
import { useMunicipalityContact } from '../../hooks/useMunicipalityContact.js'
import { auth, hasFirebaseConfig } from '../../services/firebase.js'
import { StatusBanner } from '../ui/StatusBanner'
import { Button } from '../ui/Button'
import { FallbackCards } from '../ui/FallbackCards'
import { Timeline } from '../ui/Timeline'
import { buildVariants } from './buildVariants'
import { RevealHeader } from './RevealHeader'
import { SecretCodeBlock } from './SecretCodeBlock'
import { GuardianCTA } from './GuardianCTA'

function buildTimelineEvents(state: string, nowLabel: string) {
  const events = {
    success: [
      { label: 'Report received', meta: nowLabel, state: 'complete' as const },
      { label: 'First review', meta: 'Expected within 15 min', state: 'pending' as const },
      {
        label: 'Responder dispatched',
        meta: "We'll text and update here",
        state: 'pending' as const,
      },
    ],
    queued: [
      { label: 'Saved on this phone', meta: nowLabel, state: 'queued' as const },
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
      { label: 'Report drafted', meta: nowLabel, state: 'complete' as const },
      {
        label: 'Send attempt failed',
        meta: 'Network error · you can retry',
        state: 'failed' as const,
      },
      { label: 'Retry send', meta: 'Try again or call the hotline', state: 'pending' as const },
    ],
    failed_terminal: [
      { label: 'Report drafted', meta: nowLabel, state: 'complete' as const },
      {
        label: 'Sending stopped',
        meta: 'Multiple attempts failed',
        state: 'failed' as const,
      },
      {
        label: 'Call the hotline',
        meta: 'Faster than retrying the app',
        state: 'pending' as const,
      },
    ],
  }
  return events[state as keyof typeof events]
}

function useAuthGuest() {
  // null = loading (firebase present), true = guest (no account), false = registered
  const [isGuest, setIsGuest] = useState<boolean | null>(() => (hasFirebaseConfig() ? null : true))

  useEffect(() => {
    if (!hasFirebaseConfig()) return
    return onAuthStateChanged(auth(), (u) => {
      setIsGuest(u === null || u.isAnonymous)
    })
  }, [])

  return isGuest
}

function useVibrate(state: string) {
  useEffect(() => {
    if (!('vibrate' in navigator)) return
    try {
      if (state === 'success') navigator.vibrate([15, 80, 25])
      else if (state === 'queued') navigator.vibrate([30])
      else navigator.vibrate([30, 60, 30])
    } catch {
      // vibrate not available
    }
  }, [state])
}

function useSecretVisibility(
  typewriterComplete: boolean,
  secretCode: string | undefined,
  reducedMotion: boolean,
) {
  const [secretVisible, setSecretVisible] = useState(false)

  useEffect(() => {
    if (!typewriterComplete || !secretCode) return
    const t = setTimeout(
      () => {
        setSecretVisible(true)
      },
      reducedMotion ? 0 : 300,
    )
    return () => {
      clearTimeout(t)
    }
  }, [typewriterComplete, secretCode, reducedMotion])

  return secretVisible
}

export interface RevealSheetProps {
  state: 'success' | 'queued' | 'failed_retryable' | 'failed_terminal'
  referenceCode: string
  secretCode?: string
  municipalityId?: string
  onClose?: () => void
  onPrimaryAction?: () => void
}

export function RevealSheet({
  state,
  referenceCode,
  secretCode,
  municipalityId,
  onClose,
  onPrimaryAction,
}: RevealSheetProps) {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const contact = useMunicipalityContact(municipalityId)
  const variants = useMemo(() => buildVariants(contact.label), [contact.label])
  const { display: slotDisplay, done: slotDone } = useSlotMachine(
    referenceCode,
    reducedMotion ? 0 : 600,
    reducedMotion ? 0 : 400,
  )
  const displayedCode = reducedMotion ? referenceCode : slotDisplay
  const typewriterComplete = reducedMotion ? true : slotDone
  const isGuest = useAuthGuest()
  const secretVisible = useSecretVisibility(typewriterComplete, secretCode, reducedMotion)

  useVibrate(state)

  const variant = variants[state]

  const guardianIcon = useMemo(() => {
    if (state === 'success') return <Check size={16} />
    if (state === 'queued') return <Save size={16} />
    return <ShieldCheck size={16} />
  }, [state])

  const afterglowTime = new Date().toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const timelineEvents = buildTimelineEvents(state, afterglowTime)

  const handleTrackReport = useCallback(() => {
    void navigate('/')
  }, [navigate])

  const handleCallHotline = useCallback(() => {
    const telDigits = contact.hotline.replace(/[^\d+]/g, '')
    if (!telDigits || !/\d/.test(telDigits)) {
      console.warn('[RevealSheet] Invalid hotline number:', contact.hotline)
      return
    }
    window.location.href = `tel:${telDigits}`
  }, [contact.hotline])

  const handleSmsFallback = useCallback(() => {
    const normalizedHotline = contact.hotline.replace(/[^\d+]/g, '')
    if (!normalizedHotline || !/\d/.test(normalizedHotline)) {
      console.warn('[RevealSheet] Invalid hotline number:', contact.hotline)
      return
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const sep = isIOS ? '&' : '?'
    window.location.href = `sms:${normalizedHotline}${sep}body=${encodeURIComponent(`BANTAYOG ${referenceCode}\n[Add incident details]`)}`
  }, [contact.hotline, referenceCode])

  const handlePrimaryAction = useCallback(() => {
    if (onPrimaryAction) {
      onPrimaryAction()
      return
    }
    if (state === 'success') {
      handleTrackReport()
    } else if (state === 'failed_terminal') {
      handleCallHotline()
    } else {
      onClose?.()
    }
  }, [onPrimaryAction, state, handleTrackReport, handleCallHotline, onClose])

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-900/60 pointer-events-auto"
        role="button"
        aria-label="Close"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClose?.()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose?.()
          }
        }}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[90svh] overflow-y-auto bg-surface-50 rounded-t-3xl p-5 pointer-events-auto shadow-2xl"
        style={{
          animation: 'reveal-slide-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }}
      >
        <div className="w-10 h-1 bg-surface-400 rounded-full mx-auto mt-3 mb-4" />

        <RevealHeader state={state} reducedMotion={reducedMotion} />

        <StatusBanner variant={variant.bannerVariant} icon={guardianIcon}>
          {variant.headline}
        </StatusBanner>

        <p className="reveal-subheadline">
          {variant.subline}
          {variant.sublineTl ? (
            <span className="tl-hint" style={{ display: 'block', marginTop: '0.25rem' }}>
              {variant.sublineTl}
            </span>
          ) : null}
        </p>

        {/* Reference Code */}
        <div
          className={`reveal-ref-box${state === 'queued' ? ' reveal-ref-box--queued' : state === 'failed_retryable' ? ' reveal-ref-box--failed' : ''}`}
        >
          <div className="reveal-ref-label">
            {state === 'queued' ? 'Draft reference' : 'Reference'}
          </div>
          <div className="reveal-ref-code">{displayedCode}</div>
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

        <Timeline events={timelineEvents} />

        {state === 'success' && typewriterComplete && (
          <div className="text-center text-xs text-surface-600 mt-2">
            Sent at {afterglowTime} · {contact.label} is on it
          </div>
        )}

        {secretCode && state === 'success' && typewriterComplete && (
          <SecretCodeBlock
            secretCode={secretCode}
            reducedMotion={reducedMotion}
            secretVisible={secretVisible}
          />
        )}

        <FallbackCards
          hotlineNumber={contact.hotline}
          emphasized={state !== 'success' ? state === 'failed_retryable' : false}
          onCallClick={handleCallHotline}
          onSmsClick={handleSmsFallback}
        />

        <Button
          variant={variant.primaryVariant}
          fullWidth
          onClick={handlePrimaryAction}
          className="mt-4"
        >
          {variant.primaryButton}
        </Button>

        {variant.secondaryButton ? (
          <div className="reveal-secondary-btn">
            <Button variant="secondary" fullWidth onClick={onClose}>
              {variant.secondaryButton}
            </Button>
          </div>
        ) : null}

        {state === 'success' && isGuest && <GuardianCTA />}

        <p className="reveal-footer">{variant.permissionText}</p>
      </div>
    </div>
  )
}
