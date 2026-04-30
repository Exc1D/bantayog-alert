import { useState, useEffect, useCallback } from 'react'
import { Check, Clock, AlertTriangle, Copy } from 'lucide-react'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { StatusBanner } from './ui/StatusBanner'
import { Button } from './ui/Button'
import { FallbackCards } from './ui/FallbackCards'
import { Timeline } from './ui/Timeline'

const HOTLINE_NUMBER = '(054) 721-1216'

interface RevealSheetProps {
  state: 'success' | 'queued' | 'failed_retryable'
  referenceCode: string
  secretCode?: string
  reportCount?: number
  onClose?: () => void
}

export function RevealSheet({
  state,
  referenceCode,
  secretCode,
  reportCount,
  onClose,
}: RevealSheetProps) {
  const reducedMotion = useReducedMotion()
  const [displayedChars, setDisplayedChars] = useState(reducedMotion ? referenceCode.length : 0)
  const [typewriterComplete, setTypewriterComplete] = useState(reducedMotion)
  const [copied, setCopied] = useState(false)
  const [secretVisible, setSecretVisible] = useState(false)
  const [upgradeDismissed, setUpgradeDismissed] = useState(() => {
    try {
      return localStorage.getItem('bantayog_upgrade_prompted') === '1'
    } catch {
      return false
    }
  })
  const showUpgradePrompt = reportCount != null && reportCount > 0 && !upgradeDismissed
  const variants = {
    success: {
      icon: <Check size={16} />,
      headline: 'We heard you. We are here.',
      subline: 'Your report is with Daet MDRRMO. Keep your line open.',
      sublineTl: 'Narinig namin kayo. Hawak na ng MDRRMO ang inyong ulat.',
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
      sublineTl: undefined,
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
      sublineTl: 'Ligtas pa rin ang inyong ulat dito sa telepono. Kung emergency, tawagan kami.',
      bannerVariant: 'failed' as const,
      receiverText: undefined,
      primaryButton: 'Try again',
      primaryVariant: 'red' as const,
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll hold this draft for 24 hours.",
    },
  }

  const variant = variants[state]

  const displayedCode = referenceCode.slice(0, displayedChars)

  useEffect(() => {
    if (reducedMotion) return
    let charInterval: ReturnType<typeof setInterval> | null = null
    const settleTimeout = setTimeout(() => {
      let i = 0
      charInterval = setInterval(() => {
        i += 1
        setDisplayedChars(i)
        if (i >= referenceCode.length) {
          if (charInterval) clearInterval(charInterval)
          setTypewriterComplete(true)
        }
      }, 60)
    }, 400)
    return () => {
      clearTimeout(settleTimeout)
      if (charInterval) clearInterval(charInterval)
    }
  }, [referenceCode, reducedMotion])

  useEffect(() => {
    if (state === 'success' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 80, 25])
      } catch {
        // vibrate not available
      }
    }
  }, [state])

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

  const handleCopySecret = useCallback(async () => {
    if (!secretCode) return
    try {
      await navigator.clipboard.writeText(secretCode)
      setCopied(true)
      const t = setTimeout(() => {
        setCopied(false)
      }, 2000)
      void t
    } catch (e) {
      console.error('Failed to copy secret code:', e)
    }
  }, [secretCode])

  const afterglowTime = new Date().toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleDismissUpgrade = () => {
    try {
      localStorage.setItem('bantayog_upgrade_prompted', '1')
    } catch {
      /* */
    }
    setUpgradeDismissed(true)
  }

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
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute inset-0 bg-[#171a1a]/60 backdrop-blur-sm pointer-events-auto"
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
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[90svh] overflow-y-auto bg-[#f8fafa] rounded-t-3xl p-5 pointer-events-auto shadow-2xl"
        style={{
          animation: 'reveal-slide-up 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <div className="w-10 h-1 bg-[#a3adae] rounded-full mx-auto mt-3 mb-4" />

        <StatusBanner variant={variant.bannerVariant} icon={variant.icon}>
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

        <Timeline events={timelineEvents[state]} />

        {state === 'success' && typewriterComplete && (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#52606d', marginTop: 8 }}>
            Sent at {afterglowTime} · Daet MDRRMO is on it
          </div>
        )}

        {secretCode && state === 'success' && typewriterComplete && (
          <div
            style={{
              margin: '12px 0',
              borderTop: '1px solid rgba(167,52,0,0.15)',
              paddingTop: 12,
              opacity: secretVisible ? 1 : 0,
              transition: reducedMotion ? 'none' : 'opacity 300ms ease-in',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#a73400',
                }}
              >
                Secret Code
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  background: '#001e40',
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: 4,
                  letterSpacing: '0.04em',
                }}
              >
                SHOWN ONCE
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <code className="flex-1 px-3 py-2 bg-white rounded-md text-sm font-mono tracking-wider">
                {secretCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  void handleCopySecret()
                }}
                className="p-2 border-0 bg-[#0f9488] rounded-lg cursor-pointer flex items-center"
                aria-label="Copy secret code"
              >
                <Copy size={16} className="text-white" />
              </button>
            </div>
            {copied && (
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#16a34a' }}>Copied!</p>
            )}
            <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: '#7b8794' }}>
              Save this to check your report without an account.
              <span style={{ display: 'block', fontStyle: 'italic' }}>
                I-save ito para macheck ang ulat nang walang account.
              </span>
            </p>
          </div>
        )}

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

        {showUpgradePrompt && state === 'success' && (
          <div
            style={{
              margin: '12px 0',
              padding: '12px',
              borderRadius: 8,
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#001e40',
              }}
            >
              {reportCount === 1
                ? 'Save your report history — create an account.'
                : `You have ${String(reportCount)} reports. Create an account to keep them all.`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href="/register"
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#f26522',
                  textDecoration: 'none',
                }}
              >
                Create account
              </a>
              <button
                type="button"
                onClick={handleDismissUpgrade}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '0.75rem',
                  color: '#7b8794',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <p className="reveal-footer">{variant.permissionText}</p>
      </div>
    </div>
  )
}
