import { useState, useRef, useCallback } from 'react'
import { Copy } from 'lucide-react'

interface SecretCodeBlockProps {
  secretCode: string
  reducedMotion: boolean
  secretVisible: boolean
}

export function SecretCodeBlock({
  secretCode,
  reducedMotion,
  secretVisible,
}: SecretCodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [hasCopyError, setHasCopyError] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(secretCode)
      setCopied(true)
      setHasCopyError(false)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      setCopied(false)
      setHasCopyError(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setHasCopyError(false)
      }, 3000)
    }
  }, [secretCode])

  return (
    <div
      className="my-3 border-t border-danger-900/10 pt-3"
      style={{
        opacity: secretVisible ? 1 : 0,
        transition: reducedMotion ? 'none' : 'opacity 300ms ease-in',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-warning-700">
          Secret Code
        </span>
        <span
          className="text-[10px] font-bold bg-surface-900 text-white px-1.5 py-0.5 rounded"
          style={{ letterSpacing: '0.04em' }}
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
            void handleCopy()
          }}
          className="min-h-11 min-w-11 border-0 bg-brand-500 rounded-lg cursor-pointer flex items-center justify-center"
          aria-label="Copy secret code"
        >
          <Copy size={16} className="text-white" />
        </button>
      </div>

      {copied && <p className="mt-1 text-xs text-success-600">Copied!</p>}
      {hasCopyError && (
        <p className="mt-1 text-xs text-danger-600">Copy failed. Please write it down</p>
      )}

      <p className="mt-2 text-xs text-surface-500">
        Save this to check your report without an account.
        <span className="block italic">I-save ito para macheck ang ulat nang walang account.</span>
      </p>
    </div>
  )
}
