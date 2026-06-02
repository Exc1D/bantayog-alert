import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { Toggle } from '../components/Toggle.js'
import { DeleteAccountFlow } from '../components/DeleteAccountFlow.js'
import { useToast } from '../hooks/useToast.js'
import { useFcmToken } from '../hooks/useFcmToken.js'
import { Toast } from '../components/Toast.js'
import { auth, hasFirebaseConfig } from '../services/firebase.js'
import { requestAnonymousDeletion, requestDataExport } from '../services/callables.js'
import {
  getAlertSoundsEnabled,
  getAutoLocationEnabled,
  getOfflineModeEnabled,
  SETTINGS_KEYS,
} from '../lib/userSettings.js'

const INITIAL_STORAGE_INFO = 'Loading…'

export function SettingsPage() {
  const navigate = useNavigate()
  const { show, message, type, toast } = useToast()
  const { enabled, requestPermission, disable } = useFcmToken()
  const [user, setUser] = useState<User | null>(null)
  const [offlineMode, setOfflineMode] = useState(getOfflineModeEnabled)
  const [storageInfo, setStorageInfo] = useState<string>(INITIAL_STORAGE_INFO)
  const [alertSounds, setAlertSounds] = useState(getAlertSoundsEnabled)
  const [autoLocation, setAutoLocation] = useState(getAutoLocationEnabled)

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
      localStorage.setItem(SETTINGS_KEYS.offlineMode, String(v))
    } catch (e) {
      console.error('Failed to set bantayog_offline_mode:', v, e)
      setOfflineMode((prev) => !prev)
    }
  }

  const handleAlertSoundsToggle = (next: boolean) => {
    setAlertSounds(next)
    try {
      localStorage.setItem(SETTINGS_KEYS.alertSounds, String(next))
    } catch (err) {
      console.error('Failed to persist alert sounds setting:', err)
      setAlertSounds((prev) => !prev)
    }
  }

  const handleAutoLocationToggle = (next: boolean) => {
    setAutoLocation(next)
    try {
      localStorage.setItem(SETTINGS_KEYS.autoLocation, String(next))
    } catch (err) {
      console.error('Failed to persist auto-location setting:', err)
      setAutoLocation((prev) => !prev)
    }
  }

  const handleDataExport = async () => {
    try {
      const { downloadUrl } = await requestDataExport()
      const response = await fetch(downloadUrl)
      if (!response.ok) {
        throw new Error(`Download failed: ${String(response.status)}`)
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = 'bantayog-export.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
      toast('Your data is downloading.', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('resource-exhausted')) {
        toast('You requested an export recently. Try again in a minute.', 'info')
      } else {
        toast('Export failed. Please try again.', 'error')
      }
    }
  }

  const handleDeleteSessionData = useCallback(async () => {
    if (!user?.isAnonymous) return
    if (!window.confirm('This will delete your anonymous session data and sign you out. Continue?'))
      return
    try {
      await requestAnonymousDeletion()
      await signOut(auth())
      void navigate('/', { replace: true })
      toast('Session data deleted.', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('permission-denied')) {
        toast('Cannot delete registered accounts here.', 'error')
      } else {
        toast('Failed to delete session data. Please try again.', 'error')
      }
    }
  }, [navigate, toast, user])

  return (
    <main id="main-content" className="min-h-[100dvh] bg-[#f0f4f4]">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b bg-white border-[#d5dedd]">
        <button
          type="button"
          onClick={() => {
            void navigate(-1)
          }}
          className="min-h-11 min-w-11 flex items-center justify-center border-none bg-transparent cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-[#25292a]" />
        </button>
        <h1 className="m-0 font-semibold text-lg text-[#25292a]">Settings</h1>
      </div>

      {/* Notifications section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-surface-600">
        Notifications
      </p>
      <div className="bg-white divide-y divide-[#f0f4f4]">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
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
              disabled={typeof Notification !== 'undefined' && Notification.permission === 'denied'}
            />
          </div>
          {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
            <p className="text-xs text-surface-500 mt-1">
              Notifications blocked in browser. Enable in site settings.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium text-[#25292a]">Alert sounds</span>
          <Toggle checked={alertSounds} onChange={handleAlertSoundsToggle} label="Alert sounds" />
        </div>
      </div>

      {/* Location section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-surface-600">
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
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-surface-600">
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
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-surface-600">
        Storage
      </p>
      <div className="bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium text-[#25292a]">{storageInfo}</span>
        </div>
      </div>

      {/* Account section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-surface-600">
        Account
      </p>
      <div className="bg-white divide-y divide-[#f0f4f4]">
        {user && !user.isAnonymous && (
          <div className="flex flex-col gap-1 px-4 py-4">
            <button
              type="button"
              onClick={() => void handleDataExport()}
              className="text-sm font-medium bg-transparent border-none p-0 cursor-pointer text-left text-[#25292a]"
            >
              Download my data
            </button>
            <span className="text-xs text-surface-500">
              Receive a JSON export of your profile, reports, and media.
            </span>
          </div>
        )}
        {window.deferredInstallPrompt && (
          <div className="flex items-center justify-between px-4 py-4">
            <button
              type="button"
              onClick={() => {
                void window.deferredInstallPrompt?.prompt()
              }}
              className="text-sm font-medium bg-transparent border-none p-0 cursor-pointer text-left text-[#25292a]"
            >
              Add to Home Screen
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
        {user && (
          <div className="flex items-center justify-between px-4 py-4">
            <button
              type="button"
              onClick={() => {
                void auth()
                  .signOut()
                  .then(() => void navigate('/'))
              }}
              className="text-sm font-medium bg-transparent border-none p-0 cursor-pointer text-left text-[#25292a]"
            >
              Sign out
            </button>
          </div>
        )}
        {user?.isAnonymous && (
          <div className="flex items-center justify-between px-4 py-4">
            <button
              type="button"
              onClick={() => {
                void handleDeleteSessionData()
              }}
              className="text-sm font-medium bg-transparent border-none p-0 cursor-pointer text-left text-danger-500"
            >
              Delete session data
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone section */}
      <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2 text-surface-600">
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
    </main>
  )
}
