import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase.js'

const STORAGE_KEY = 'bantayog_privacy_v1'
const NOTICE_VERSION = '1.0'

interface Props {
  uid: string | null
}

export function PrivacyNoticeModal({ uid }: Props) {
  const [visible, setVisible] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && !localStorage.getItem(STORAGE_KEY)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.warn('[PrivacyNotice] localStorage quota exceeded')
      } else {
        console.error('[PrivacyNotice] Unexpected localStorage error:', err)
      }
      return false
    }
  })

  function handleDismiss() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, '1')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.warn('[PrivacyNotice] localStorage quota exceeded')
      } else {
        console.error('[PrivacyNotice] Unexpected localStorage error:', err)
      }
    }
    setVisible(false)

    if (uid) {
      void setDoc(
        doc(db(), 'users', uid),
        { privacyNoticeVersion: NOTICE_VERSION },
        { merge: true },
      ).catch((err: unknown) => {
        console.warn('[PrivacyNotice] Failed to persist consent:', err)
      })
    }
  }

  if (!visible) return null

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
      aria-label="Abiso sa Pagprotekta ng Datos"
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
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
          Abiso sa Pagprotekta ng Datos
          <br />
          <span style={{ fontWeight: 400, fontSize: '0.95rem' }}>Data Privacy Notice</span>
        </h2>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Sa paggamit ng <strong>Bantayog Alert</strong>, sumasang-ayon ka na ang iyong mga ulat,
          lokasyon, at impormasyon sa pakikipag-ugnayan ay maaaring gamitin para sa koordinasyon ng
          pagtugon sa sakuna sa Camarines Norte.
        </p>
        <p
          style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.75rem', color: '#4b5563' }}
        >
          By using <strong>Bantayog Alert</strong>, you agree that your reports, location, and
          contact information may be used to coordinate disaster response in Camarines Norte.
        </p>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Ang iyong datos ay protektado ayon sa <strong>Batas Republika 10173</strong> (Data Privacy
          Act of 2012). Mayroon kang karapatang ma-access, itama, at hilingin ang pagbubura ng iyong
          personal na datos.
        </p>
        <p
          style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', color: '#4b5563' }}
        >
          Your data is protected under <strong>Republic Act 10173</strong> (Data Privacy Act of
          2012). You have the right to access, correct, and request erasure of your personal data.
          Contact PDRRMO Camarines Norte for inquiries.
        </p>
        <button
          onClick={handleDismiss}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#1d4ed8',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-label="Sang-ayon at isara / I Agree and Close"
        >
          Sang-ayon / I Agree
        </button>
      </div>
    </div>
  )
}
