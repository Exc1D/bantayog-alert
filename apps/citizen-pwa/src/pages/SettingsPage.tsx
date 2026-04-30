import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, AlertTriangle } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '../services/firebase.js'
import { Toggle } from '../components/Toggle.js'
import { DeleteAccountFlow } from '../components/DeleteAccountFlow.js'
import { useToast } from '../hooks/useToast.js'
import { Toast } from '../components/Toast.js'

const INITIAL_STORAGE_INFO = 'Loading…'

export function SettingsPage() {
  const navigate = useNavigate()
  const { show, message, type, toast } = useToast()
  const [pushEnabled, setPushEnabled] = useState(false)
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
  const [exportDisabled, setExportDisabled] = useState(() => {
    try {
      return sessionStorage.getItem('bantayog_export_requested') === '1'
    } catch {
      return false
    }
  })

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

  const handleAlertSoundsToggle = (v: boolean) => {
    setAlertSounds(v)
    try {
      localStorage.setItem('bantayog_alert_sounds', String(v))
    } catch {
      /* */
    }
  }

  const handleAutoLocationToggle = (v: boolean) => {
    setAutoLocation(v)
    try {
      localStorage.setItem('bantayog_location_auto', String(v))
    } catch {
      /* */
    }
  }

  const handleDataExport = async () => {
    try {
      sessionStorage.setItem('bantayog_export_requested', '1')
      setExportDisabled(true)
      const { requestDataExport } = await import('../services/callables.js')
      await requestDataExport()
      toast("We'll email your data within 24 hours.", 'success')
    } catch {
      toast('Data export failed. Please try again.', 'error')
    }
    setTimeout(() => {
      try {
        sessionStorage.removeItem('bantayog_export_requested')
      } catch {
        /* */
      }
      setExportDisabled(false)
    }, 60000)
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth())
      void navigate('/', { replace: true })
    } catch (e) {
      toast('Sign out failed', 'error')
      console.error('Sign out failed:', e)
    }
  }

  return (
    <div className="min-h-[100dvh]" style={{ background: '#f0f4f4' }}>
      {/* Back header */}
      <div
        className="flex items-center gap-3 px-4 py-4 border-b"
        style={{ background: '#fff', borderColor: '#d5dedd' }}
      >
        <button
          type="button"
          onClick={() => {
            void navigate(-1)
          }}
          className="p-0 border-none bg-transparent cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={20} style={{ color: '#25292a' }} />
        </button>
        <h1 className="m-0 font-semibold" style={{ fontSize: 18, color: '#25292a' }}>
          Settings
        </h1>
      </div>

      {/* Notifications section */}
      <p
        className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2"
        style={{ color: '#768081' }}
      >
        Notifications
      </p>
      <div className="bg-white divide-y" style={{ borderColor: '#f0f4f4' }}>
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium" style={{ color: '#25292a' }}>
            Push notifications
          </span>
          <Toggle checked={pushEnabled} onChange={setPushEnabled} label="Push notifications" />
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium" style={{ color: '#25292a' }}>
            Alert sounds
          </span>
          <Toggle checked={alertSounds} onChange={handleAlertSoundsToggle} label="Alert sounds" />
        </div>
      </div>

      {/* Location section */}
      <p
        className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2"
        style={{ color: '#768081' }}
      >
        Location
      </p>
      <div className="bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium" style={{ color: '#25292a' }}>
            Auto-detect location
          </span>
          <Toggle
            checked={autoLocation}
            onChange={handleAutoLocationToggle}
            label="Auto-detect location"
          />
        </div>
      </div>

      {/* Offline Mode section */}
      <p
        className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2"
        style={{ color: '#768081' }}
      >
        Offline Mode
      </p>
      <div className="bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium" style={{ color: '#25292a' }}>
            Offline-first cache
          </span>
          <Toggle
            checked={offlineMode}
            onChange={handleOfflineToggle}
            label="Offline-first cache"
          />
        </div>
      </div>

      {/* Storage section */}
      <p
        className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2"
        style={{ color: '#768081' }}
      >
        Storage
      </p>
      <div className="bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-medium" style={{ color: '#25292a' }}>
            {storageInfo}
          </span>
        </div>
      </div>

      {/* Account section */}
      <p
        className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2"
        style={{ color: '#768081' }}
      >
        Account
      </p>
      <div className="bg-white divide-y" style={{ borderColor: '#f0f4f4' }}>
        <div className="flex items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => {
              void handleDataExport()
            }}
            disabled={exportDisabled}
            className="text-sm font-medium bg-transparent border-none p-0 cursor-pointer disabled:cursor-not-allowed"
            style={{ color: exportDisabled ? '#768081' : '#25292a' }}
          >
            {exportDisabled ? 'Coming soon' : 'Download my data'}
          </button>
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <a
            href="https://bantayog.alert/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium no-underline"
            style={{ color: '#25292a' }}
          >
            Privacy Policy
          </a>
        </div>
      </div>

      {/* Danger Zone section */}
      <p
        className="text-xs font-semibold uppercase tracking-wider px-4 pt-6 pb-2"
        style={{ color: '#768081' }}
      >
        Danger Zone
      </p>
      <div className="bg-white divide-y" style={{ borderColor: '#f0f4f4' }}>
        <div className="flex items-center gap-2 px-4 py-4">
          <AlertTriangle size={16} style={{ color: '#dc2626' }} />
          <DeleteAccountFlow onGoodbye={() => void navigate('/goodbye')} />
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => {
              void handleSignOut()
            }}
            className="flex items-center gap-2 text-sm font-medium bg-transparent border-none p-0 cursor-pointer"
            style={{ color: '#dc2626' }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>

      <div className="pb-8" />

      <Toast show={show} message={message} type={type} />
    </div>
  )
}
