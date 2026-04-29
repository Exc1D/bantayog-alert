import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../app/firebase'

const NOTICE_VERSION = '1.0'

interface Props {
  uid: string
}

export function PrivacyNoticeModal({ uid }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    void getDoc(doc(db, 'users', uid)).then((snap) => {
      const version = snap.data()?.privacyNoticeVersion as string | undefined
      if (version !== NOTICE_VERSION) setVisible(true)
    })
  }, [uid])

  function handleDismiss() {
    setVisible(false)
    void setDoc(doc(db, 'users', uid), { privacyNoticeVersion: NOTICE_VERSION }, { merge: true })
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
          Abiso sa Pagprotekta ng Datos / Data Privacy Notice
        </h2>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Bilang responder ng <strong>Bantayog Alert</strong>, ang iyong lokasyon at mga aksyon ay
          naitala para sa koordinasyon ng pagtugon sa sakuna sa Camarines Norte.
        </p>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', color: '#4b5563' }}>
          As a <strong>Bantayog Alert</strong> responder, your location and actions are logged to
          coordinate disaster response. Your data is protected under Republic Act 10173.
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
        >
          Sang-ayon / I Agree
        </button>
      </div>
    </div>
  )
}
