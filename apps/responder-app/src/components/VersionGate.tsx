import type { ReactNode } from 'react'
import { useVersionGate } from '../hooks/useVersionGate'

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

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
          App Update Required
        </h1>
        <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
          Mangyaring i-install ang pinakabagong bersyon para makapagpatuloy.
          <br />
          Please install the latest version to continue.
        </p>
        {updateUrl && isValidHttpsUrl(updateUrl) && (
          <a href={updateUrl} style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
            Download update
          </a>
        )}
      </div>
    )
  }

  return <>{children}</>
}
