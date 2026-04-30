import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut } from 'lucide-react'
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

  const sectionStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: '1px solid #e5e7eb',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#7b8794',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 12,
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f5f7fa' }}>
      <div
        style={{
          background: '#001e40',
          color: '#fff',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => {
            void navigate(-1)
          }}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          aria-label="Go back"
        >
          <ChevronLeft size={20} color="#fff" />
        </button>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Settings</h1>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Notifications</div>
        <Toggle checked={pushEnabled} onChange={setPushEnabled} label="Push notifications" />
        <div style={{ marginTop: 12 }}>
          <Toggle checked={alertSounds} onChange={handleAlertSoundsToggle} label="Alert sounds" />
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Location</div>
        <Toggle
          checked={autoLocation}
          onChange={handleAutoLocationToggle}
          label="Auto-detect location"
        />
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Offline Mode</div>
        <Toggle checked={offlineMode} onChange={handleOfflineToggle} label="Offline-first cache" />
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Storage</div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#001e40' }}>{storageInfo}</p>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Account</div>
        <button
          type="button"
          onClick={() => {
            void handleDataExport()
          }}
          disabled={exportDisabled}
          style={{
            border: 'none',
            background: 'none',
            color: exportDisabled ? '#7b8794' : '#001e40',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: exportDisabled ? 'not-allowed' : 'pointer',
            padding: '8px 0',
            display: 'block',
          }}
        >
          {exportDisabled ? 'Coming soon' : 'Download my data'}
        </button>
        <a
          href="https://bantayog.alert/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            marginTop: 8,
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#001e40',
            textDecoration: 'none',
          }}
        >
          Privacy Policy
        </a>
      </div>

      <div style={sectionStyle}>
        <div style={{ ...labelStyle, color: '#b71c1c' }}>Danger Zone</div>
        <DeleteAccountFlow onGoodbye={() => void navigate('/goodbye')} />
      </div>

      <div style={{ padding: '24px 16px' }}>
        <button
          type="button"
          onClick={() => {
            void handleSignOut()
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px',
            border: '1px solid #e5e7eb',
            borderRadius: 999,
            background: '#fff',
            color: '#b71c1c',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      <Toast show={show} message={message} type={type} />
    </div>
  )
}
