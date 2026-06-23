import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../app/firebase'

const NOTICE_VERSION = '1.0'
const CONSENT_STORAGE_PREFIX = 'bantayog.responder.privacy-consent'

interface Props {
  uid: string
}

interface ConsentStatus {
  uid: string
  accepted: boolean | null
}

function getConsentStorageKey(uid: string) {
  return `${CONSENT_STORAGE_PREFIX}:${uid}`
}

function readLocalConsent(uid: string) {
  try {
    return globalThis.localStorage.getItem(getConsentStorageKey(uid))
  } catch {
    return null
  }
}

function writeLocalConsent(uid: string) {
  try {
    globalThis.localStorage.setItem(getConsentStorageKey(uid), NOTICE_VERSION)
  } catch {
    // Firestore remains the source of truth when local storage is unavailable.
  }
}

export function PrivacyNoticeModal({ uid }: Props) {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>(() => ({
    uid,
    accepted: readLocalConsent(uid) === NOTICE_VERSION ? true : null,
  }))
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (readLocalConsent(uid) === NOTICE_VERSION) return

    let cancelled = false
    void getDoc(doc(db, 'user_consents', uid))
      .then((snap) => {
        if (cancelled) return
        const version = snap.data()?.consentVersion as string | undefined
        const accepted = version === NOTICE_VERSION
        if (accepted) writeLocalConsent(uid)
        setConsentStatus({ uid, accepted })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('[PrivacyNotice] Failed to read consent doc:', err)
        setConsentStatus({ uid, accepted: false })
      })

    return () => {
      cancelled = true
    }
  }, [uid])

  async function handleDismiss() {
    setIsSubmitting(true)
    writeLocalConsent(uid)
    setConsentStatus({ uid, accepted: true })

    try {
      await setDoc(doc(db, 'user_consents', uid), {
        consentVersion: NOTICE_VERSION,
        consentGivenAt: serverTimestamp(),
        method: 'in_app_modal',
      })
    } catch (err: unknown) {
      console.error('[PrivacyNotice] Failed to persist consent:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const acceptedLocally = readLocalConsent(uid) === NOTICE_VERSION
  const currentStatus = consentStatus.uid === uid ? consentStatus.accepted : null
  const shouldShow = !acceptedLocally && currentStatus === false

  if (!shouldShow) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-notice-title"
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '32rem',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2
          id="privacy-notice-title"
          style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}
        >
          Abiso sa Pagprotekta ng Datos / Data Privacy Notice
        </h2>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Bilang responder ng <strong>Bantayog Alert</strong>, ang iyong lokasyon at mga aksyon ay
          naitala para sa koordinasyon ng pagtugon sa sakuna sa Camarines Norte.
        </p>
        <p
          style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', color: '#4b5563' }}
        >
          As a <strong>Bantayog Alert</strong> responder, your location and actions are logged to
          coordinate disaster response. Your data is protected under Republic Act 10173.
        </p>
        <button
          onClick={() => void handleDismiss()}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#1d4ed8',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Saving…' : 'Sang-ayon / I Agree'}
        </button>
      </div>
    </div>
  )
}
