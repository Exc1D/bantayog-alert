import type { ReactNode } from 'react'
import { useVersionGate } from '../hooks/useVersionGate.js'

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
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white p-8 text-center z-[9999]">
        <h1 className="text-xl font-bold mb-3">
          Mangyaring i-update ang app
          <br />
          Please update the app
        </h1>
        <p className="text-surface-600 mb-6 max-w-[20rem]">
          Ang iyong bersyon ay hindi na sinusuportahan.
          <br />
          Your version is no longer supported.
        </p>
        {updateUrl && isValidHttpsUrl(updateUrl) ? (
          <a href={updateUrl} className="text-blue-700 underline font-semibold">
            I-download ang pinakabagong bersyon / Download the latest version
          </a>
        ) : (
          <p className="text-surface-500 text-sm">
            Makipag-ugnayan sa inyong LGU para sa tulong. / Contact your LGU for assistance.
          </p>
        )}
      </div>
    )
  }

  return <>{children}</>
}
