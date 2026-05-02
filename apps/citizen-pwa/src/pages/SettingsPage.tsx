import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { Toggle } from '../components/Toggle.js'
import { DeleteAccountFlow } from '../components/DeleteAccountFlow.js'
import { useToast } from '../hooks/useToast.js'
import { useFcmToken } from '../hooks/useFcmToken.js'
import { Toast } from '../components/Toast.js'
import { auth, hasFirebaseConfig } from '../services/firebase.js'

const INITIAL_STORAGE_INFO = 'Loading…'
const EXPORT_COOLDOWN_MS = 60_000

function isExportCooldownActive(): boolean {
  try {
    const raw = sessionStorage.getItem('bantayog_export_until')
    if (!raw) return false
    return Date.now() < Number(raw)
  } catch {
    return false
  }
}

function setExportCooldown(until: number | null): void {
  try {
    if (until === null) {
      sessionStorage.removeItem('bantayog_export_until')
    } else {
      sessionStorage.setItem('bantayog_export_until', String(until))
    }
  } catch {
    // ignore
  }
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { show, message, type, toast } = useToast()
  const { enabled, requestPermission, disable } = useFcmToken()
  const [user, setUser] = useState<User | null>(null)
  const [offlineMode, setOfflineMode] = useState(() => {
    try {
      return localStorage.getItem('bantayog_offline_mode') === 'true'
    } catch {
      return false
    }
  })
  const [storageInfo, setStorageInfo] = useState<string>(INITIAL_STORAGE_INFO)
  const [alertSounds, setAlertSounds] = useState(() => {
    try {
      return localStorage.getItem('bantayog_alert_sounds') === 'true'
    } catch {
      return true
    }
  })
  const [autoLocation, setAutoLocation] = useState(() => {
    try {
      return localStorage.getItem('bantayog_location_auto') !== 'false'
    } catch {
      return true
    }
  })
  const [exportDisabled, setExportDisabled] = useState(isExportCooldownActive)

  useEffect(() => {
    if (!hasFirebaseConfig()) return
    return onAuthStateChanged(auth(), (u) => {
      setUser(u)
    })
  }, [])

  useEffect(() => {
    const hasStorage =
      typeof (navigator as { storage?: { estimate?: unknown } }).storage?.estimate === 'function'
    if (!hasStorage) {
      queueMicrotask(() => {
        setStorageInfo('Storage info unavailable')
      })
      return
    }
    void navigator.storage
      .estimate()
      .then(({ usage, quota }) => {
        const usedMB = ((usage ?? 0) / (1024 * 1024)).toFixed(1)
        const totalMB = ((quota ?? 0) / (1024 * 1024)).toFixed(0)
        setStorageInfo(`Using ${usedMB} MB of ${totalMB} MB`)
      })
      .catch(() => {
        setStorageInfo('Storage info unavailable')
      })
  }, [])

  const handleOfflineToggle = (v: boolean) => {
    setOfflineMode(v)
    try {
      localStorage.setItem('bantayog_offline_mode', String(v))
    } catch (e) {
      console.error('Failed to set bantayog_offline_mode:', v, e)
    }
  }

  const handleAlertSoundsToggle = (next: boolean) => {
    setAlertSounds(next)
    try {
      localStorage.setItem('bantayog_alert_sounds', String(next))
    } catch (err) {
      console.error('Failed to persist alert sounds setting:', err)
      setAlertSounds((prev) => !prev)
    }
  }

  const handleAutoLocationToggle = (next: boolean) => {
    setAutoLocation(next)
    try {
      localStorage.setItem('bantayog_location_auto', String(next))
    } catch (err) {
      console.error('Failed to persist auto-location setting:', err)
      setAutoLocation((prev) => !prev)
    }
  }

  const handleDataExport = async () => {
    const until = Date.now() + EXPORT_COOLDOWN_MS
    setExportCooldown(until)
    setExportDisabled(true)
    try {
      const { requestDataExport } = await import('../services/callables.js')
      await requestDataExport()
      toast("We'll email your data within 24 hours.", 'success')
    } catch {
      toast('Data export failed. Please try again.', 'error')
      setExportCooldown(null)
      setExportDisabled(false)
      return
    }
    setTimeout(() => {
      setExportCooldown(null)
      setExportDisabled(false)
    }, EXPORT_COOLDOWN_MS)
  }

  return (
    <div className="min-h-[100dvh] bg-[#f0f4f4]">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b bg-white border-[#d5dedd]">
        <button
          type="button"
          onClick={() => {
            void navigate(-1)
          }}
          className="p-0 border-none bg-transparent cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-[#25292a]" />
        </button>
        <h1 className="m-0 font-semibold text-lg text-[#25292a]">Settings</h1>
      </div>

      {/* Notifications section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-[#768081]">
        Notifications
      </p>
      <div className="bg-white divide-y divide-[#f0f4f4]">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium text-[#25292a]">Push notifications</span>
          <Toggle
            checked={enabled}
            onChange={(next) => {
              void (async () => {
                if (next) {
                  const success = await requestPermission()
                  if (!success) {
                    toast(
                      'Failed to enable notifications. Please check browser permissions.',
                      'error',
                    )
                  }
                } else {
                  await disable()
                }
              })()
            }}
            label="Push notifications"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium text-[#25292a]">Alert sounds</span>
          <Toggle checked={alertSounds} onChange={handleAlertSoundsToggle} label="Alert sounds" />
        </div>
      </div>

      {/* Location section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-[#768081]">
        Location
      </p>
      <div className="bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium text-[#25292a]">Auto-detect location</span>
          <Toggle
            checked={autoLocation}
            onChange={handleAutoLocationToggle}
            label="Auto-detect location"
          />
        </div>
      </div>

      {/* Offline Mode section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-[#768081]">
        Offline Mode
      </p>
      <div className="bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium text-[#25292a]">Offline-first cache</span>
          <Toggle
            checked={offlineMode}
            onChange={handleOfflineToggle}
            label="Offline-first cache"
          />
        </div>
      </div>

      {/* Storage section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-[#768081]">
        Storage
      </p>
      <div className="bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium text-[#25292a]">{storageInfo}</span>
        </div>
      </div>

      {/* Account section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-[#768081]">
        Account
      </p>
      <div className="bg-white divide-y divide-[#f0f4f4]">
        {user && !user.isAnonymous && (
          <div className="flex items-center justify-between px-4 py-4">
            <button
              type="button"
              onClick={() => {
                void handleDataExport()
              }}
              disabled={exportDisabled}
              className={`text-sm font-medium bg-transparent border-none p-0 cursor-pointer disabled:cursor-not-allowed ${exportDisabled ? 'text-[#768081]' : 'text-[#25292a]'}`}
            >
              {exportDisabled ? 'Coming soon' : 'Download my data'}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-4">
          <a
            href="https://bantayog.alert/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium no-underline text-[#25292a]"
          >
            Privacy Policy
          </a>
        </div>
      </div>

      {/* Danger Zone section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-[#768081]">
        Danger Zone
      </p>
      <div className="bg-white divide-y divide-[#f0f4f4]">
        <div className="flex items-center gap-2 px-4 py-4">
          <AlertTriangle size={16} className="text-[#dc2626]" />
          <DeleteAccountFlow onGoodbye={() => void navigate('/goodbye')} />
        </div>
      </div>

      <div className="pb-8" />

      <Toast show={show} message={message} type={type} />
    </div>
  )
}
