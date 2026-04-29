import type { ReactNode } from 'react'
import { useVersionGate } from '../hooks/useVersionGate.js'

interface Props {
  children: ReactNode
}

export function VersionGate({ children }: Props) {
  const { blocked, updateUrl } = useVersionGate()

  if (blocked) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          padding: '2rem',
          textAlign: 'center',
          zIndex: 9999,
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Mangyaring i-update ang app
          <br />
          Please update the app
        </h1>
        <p style={{ color: '#4b5563', marginBottom: '1.5rem', maxWidth: '20rem' }}>
          Ang iyong bersyon ay hindi na sinusuportahan.
          <br />
          Your version is no longer supported.
        </p>
        {updateUrl ? (
          <a
            href={updateUrl}
            style={{ color: '#1d4ed8', textDecoration: 'underline', fontWeight: 600 }}
          >
            I-download ang pinakabagong bersyon / Download the latest version
          </a>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Makipag-ugnayan sa inyong LGU para sa tulong. / Contact your LGU for assistance.
          </p>
        )}
      </div>
    )
  }

  return <>{children}</>
}
