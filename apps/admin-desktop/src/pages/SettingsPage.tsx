import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Bell,
  Monitor,
  Shield,
  Settings,
  CheckCircle,
  Moon,
  Sun,
  ChevronRight,
  Download,
  AlertTriangle,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { AppShell } from '@/components/layout/AppShell'
import { cn } from '@/lib/utils'

type TabKey = 'profile' | 'notifications' | 'display' | 'security' | 'system'

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { key: 'display', label: 'Display', icon: <Monitor className="w-4 h-4" /> },
  { key: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { key: 'system', label: 'System Config', icon: <Settings className="w-4 h-4" /> },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const { addToast } = useUIStore()
  const [saving, setSaving] = useState(false)
  const [unsaved, setUnsaved] = useState(false)

  const handleSave = useCallback(() => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setUnsaved(false)
      addToast({
        title: 'Settings Saved',
        message: 'Your changes have been saved successfully.',
        type: 'success',
      })
    }, 1200)
  }, [addToast])

  const markUnsaved = useCallback(() => {
    setUnsaved(true)
  }, [])

  return (
    <AppShell>
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              Manage your profile, preferences, and security
            </p>
          </div>
          {unsaved && (
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-body-sm">Unsaved changes</span>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="lg:w-[200px] shrink-0">
            <div className="bg-white border border-border rounded-lg p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key)
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-body-sm transition-all whitespace-nowrap min-w-0',
                    activeTab === tab.key
                      ? 'bg-muted text-accent border-l-[3px] border-l-accent'
                      : 'text-muted-foreground hover:bg-muted border-l-[3px] border-l-transparent',
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'profile' && <ProfileTab onChange={markUnsaved} />}
                {activeTab === 'notifications' && <NotificationsTab onChange={markUnsaved} />}
                {activeTab === 'display' && <DisplayTab onChange={markUnsaved} />}
                {activeTab === 'security' && <SecurityTab addToast={addToast} />}
                {activeTab === 'system' && <SystemTab onChange={markUnsaved} />}
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !unsaved}
                className={cn(
                  'px-6 py-2 rounded-md text-body-sm font-medium transition-all',
                  unsaved
                    ? 'bg-accent text-white hover:bg-accent-hover'
                    : 'bg-muted text-muted-foreground/70 cursor-not-allowed',
                )}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 animate-spin" /> Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function ProfileTab({ onChange }: { onChange: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-lg p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center text-display-sm text-foreground overflow-hidden group cursor-pointer">
            JD
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-white">Change</span>
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">Juan Dela Cruz</div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
              Superadmin &mdash; PDRRMO Camarines Norte
            </span>
            <div className="text-body-sm text-muted-foreground mt-1">
              juan@pdrrmo.camnorte.gov.ph
            </div>
            <div className="text-body-sm text-muted-foreground">+63 9XX XXX XXXX</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Full Name" defaultValue="Juan Dela Cruz" onChange={onChange} />
          <Input
            label="Email"
            type="email"
            defaultValue="juan@pdrrmo.camnorte.gov.ph"
            onChange={onChange}
          />
          <Input label="Phone" defaultValue="+63 9XX XXX XXXX" onChange={onChange} />
          <Input
            label="Position"
            defaultValue="Provincial Disaster Response Coordinator"
            onChange={onChange}
          />
          <Input
            label="Office"
            defaultValue="PDRRMO Camarines Norte"
            onChange={onChange}
            readOnly
          />
          <Input label="Emergency Contact" defaultValue="+63 9XX XXX XXXX" onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

function NotificationsTab({ onChange }: { onChange: () => void }) {
  const [channels, setChannels] = useState({ inApp: true, email: true, sms: false, push: true })
  const [events, setEvents] = useState({
    highSeverity: true,
    ndrrmc: true,
    emergency: true,
    health: true,
    newUsers: true,
    lowSeverity: false,
    handoff: true,
    erasure: true,
    daily: false,
  })
  const [quietFrom, setQuietFrom] = useState('22:00')
  const [quietTo, setQuietTo] = useState('06:00')

  const toggleChannel = (key: keyof typeof channels) => {
    setChannels((c) => ({ ...c, [key]: !c[key] }))
    onChange()
  }
  const toggleEvent = (key: keyof typeof events) => {
    setEvents((e) => ({ ...e, [key]: !e[key] }))
    onChange()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Notification Channels</h3>
        <div className="space-y-3">
          <Toggle
            label="In-app notifications"
            enabled={channels.inApp}
            onToggle={() => {
              toggleChannel('inApp')
            }}
          />
          <Toggle
            label="Email notifications"
            enabled={channels.email}
            onToggle={() => {
              toggleChannel('email')
            }}
          />
          <Toggle
            label="SMS notifications"
            enabled={channels.sms}
            onToggle={() => {
              toggleChannel('sms')
            }}
            note="To avoid SMS overload"
          />
          <Toggle
            label="Push notifications (FCM)"
            enabled={channels.push}
            onToggle={() => {
              toggleChannel('push')
            }}
          />
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Notify me about:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(events).map(([key, val]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={val}
                onChange={() => {
                  toggleEvent(key as keyof typeof events)
                }}
                className="accent-accent w-4 h-4"
              />
              <span className="text-body-sm text-foreground capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quiet Hours</h3>
        <p className="text-xs text-muted-foreground/70 mb-3">
          Suppress non-critical notifications during these hours
        </p>
        <div className="flex items-center gap-3 mb-3">
          <div>
            <span className="text-xs text-muted-foreground block mb-1">From</span>
            <input
              type="time"
              value={quietFrom}
              onChange={(e) => {
                setQuietFrom(e.target.value)
                onChange()
              }}
              className="bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
          <span className="text-muted-foreground mt-5">to</span>
          <div>
            <span className="text-xs text-muted-foreground block mb-1">To</span>
            <input
              type="time"
              value={quietTo}
              onChange={(e) => {
                setQuietTo(e.target.value)
                onChange()
              }}
              className="bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-green-700">
          Always notify for HIGH severity and emergency declarations
        </p>
      </div>
    </div>
  )
}

function DisplayTab({ onChange }: { onChange: () => void }) {
  const [theme, setTheme] = useState<'light' | 'auto'>('light')
  const [density, setDensity] = useState<'compact' | 'normal' | 'relaxed'>('compact')
  const [lang, setLang] = useState<'en' | 'fil'>('en')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [largeText, setLargeText] = useState(false)

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Theme</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setTheme('light')
              onChange()
            }}
            className={cn(
              'p-4 rounded-lg border text-left transition-all',
              theme === 'light'
                ? 'border-accent bg-accent/10'
                : 'border-border bg-muted hover:border-muted-foreground/30',
            )}
          >
            <Sun className="w-5 h-5 text-foreground mb-2" />
            <div className="text-body-sm text-foreground font-medium">Light</div>
            <div className="text-xs text-muted-foreground/70">Default</div>
          </button>
          <button
            onClick={() => {
              setTheme('auto')
              onChange()
            }}
            className={cn(
              'p-4 rounded-lg border text-left transition-all',
              theme === 'auto'
                ? 'border-accent bg-accent/10'
                : 'border-border bg-muted hover:border-muted-foreground/30',
            )}
          >
            <Moon className="w-5 h-5 text-foreground mb-2" />
            <div className="text-body-sm text-foreground font-medium">Auto</div>
            <div className="text-xs text-muted-foreground/70">Follows system</div>
          </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Dashboard Density</h3>
        <div className="flex gap-2">
          {(['compact', 'normal', 'relaxed'] as const).map((d) => (
            <button
              key={d}
              onClick={() => {
                setDensity(d)
                onChange()
              }}
              className={cn(
                'px-4 py-2 rounded-md text-body-sm capitalize border transition-all',
                density === d
                  ? 'bg-muted text-foreground border-accent'
                  : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground/30',
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-2">
          Compact recommended for EOC multi-monitor setups
        </p>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Language</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setLang('en')
              onChange()
            }}
            className={cn(
              'px-4 py-2 rounded-md text-body-sm border transition-all',
              lang === 'en'
                ? 'bg-muted text-foreground border-accent'
                : 'border-border text-muted-foreground',
            )}
          >
            English
          </button>
          <button
            onClick={() => {
              setLang('fil')
              onChange()
            }}
            className={cn(
              'px-4 py-2 rounded-md text-body-sm border transition-all',
              lang === 'fil'
                ? 'bg-muted text-foreground border-accent'
                : 'border-border text-muted-foreground',
            )}
          >
            Filipino (Tagalog)
          </button>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-2">
          Filipino support is partial &mdash; key emergency terms remain in English
        </p>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Accessibility</h3>
        <div className="space-y-3">
          <Toggle
            label="Reduced motion"
            enabled={reducedMotion}
            onToggle={() => {
              setReducedMotion((v) => !v)
              onChange()
            }}
            note="Disables non-essential animations"
          />
          <Toggle
            label="High contrast"
            enabled={highContrast}
            onToggle={() => {
              setHighContrast((v) => !v)
              onChange()
            }}
            note="Increases contrast ratios"
          />
          <Toggle
            label="Large text"
            enabled={largeText}
            onToggle={() => {
              setLargeText((v) => !v)
              onChange()
            }}
            note="Increases base font size by 15%"
          />
        </div>
      </div>
    </div>
  )
}

function SecurityTab({
  addToast,
}: {
  addToast: (t: {
    title: string
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }) => void
}) {
  const [showCodes, setShowCodes] = useState(false)
  const [pwdModal, setPwdModal] = useState(false)
  const backupCodes = [
    '8372 9104',
    '5521 8843',
    '1092 5567',
    '3381 9920',
    '7721 0034',
    '8812 3345',
    '9920 1123',
    '4456 7789',
    '2233 4455',
    '6677 8899',
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Two-Factor Authentication</h3>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="w-3 h-3" /> Enabled
          </span>
        </div>
        <div className="text-body-sm text-muted-foreground mb-1">Last verified: Today at 14:35</div>
        <div className="text-body-sm text-muted-foreground mb-4">
          Authenticator app: Google Authenticator configured
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              addToast({
                title: 'TOTP',
                message: 'Regenerate requires current TOTP + password.',
                type: 'warning',
              })
            }}
            className="px-4 py-2 rounded-md bg-muted text-foreground border border-border text-body-sm hover:bg-white transition-all"
          >
            Regenerate TOTP Secret
          </button>
          <button
            onClick={() => {
              setShowCodes(true)
            }}
            className="px-4 py-2 rounded-md bg-muted text-foreground border border-border text-body-sm hover:bg-white transition-all"
          >
            View Backup Codes
          </button>
          <button
            onClick={() => {
              addToast({
                title: 'TOTP',
                message: 'Disable TOTP requires heavy confirmation.',
                type: 'error',
              })
            }}
            className="px-4 py-2 rounded-md bg-red-50 text-red-700 border border-red-200 text-body-sm hover:bg-red-100 transition-all"
          >
            Disable TOTP
          </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Active Sessions</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-muted rounded-md p-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-700" />
              <span className="text-body-sm text-foreground">
                This device &middot; Chrome &middot; Windows &middot; Daet, Camarines Norte
              </span>
            </div>
            <span className="text-xs text-green-700">Current</span>
          </div>
          <div className="flex items-center justify-between bg-muted rounded-md p-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/70" />
              <span className="text-body-sm text-muted-foreground">
                Mobile &middot; Safari &middot; iOS &middot; Daet
              </span>
            </div>
            <button
              onClick={() => {
                addToast({ title: 'Session', message: 'Session revoked.', type: 'success' })
              }}
              className="text-xs text-red-700 hover:underline"
            >
              Revoke
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            addToast({ title: 'Sessions', message: 'All other sessions revoked.', type: 'success' })
          }}
          className="mt-3 px-4 py-2 rounded-md bg-muted text-foreground border border-border text-body-sm hover:bg-white transition-all"
        >
          Revoke all other sessions
        </button>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Password</h3>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-body-sm text-muted-foreground">Last changed: 30 days ago</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
            Strong
          </span>
        </div>
        <button
          onClick={() => {
            setPwdModal(true)
          }}
          className="px-4 py-2 rounded-md bg-muted text-foreground border border-border text-body-sm hover:bg-white transition-all"
        >
          Change Password
        </button>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Security Events</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-foreground">TOTP verified</span>
            <span className="text-muted-foreground/70">14:35 today</span>
          </div>
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-foreground">Login from 192.168.1.100</span>
            <span className="text-muted-foreground/70">08:00 today</span>
          </div>
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-foreground">Password changed</span>
            <span className="text-muted-foreground/70">Jan 1, 2024</span>
          </div>
        </div>
        <button
          onClick={() => {
            addToast({ title: 'Redirecting', message: 'Opening audit logs...', type: 'info' })
          }}
          className="text-accent text-body-sm mt-3 hover:underline inline-flex items-center gap-1"
        >
          View full security log <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {showCodes && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowCodes(false)
            }}
            onClick={() => {
              setShowCodes(false)
            }}
          />
          <div className="relative bg-white border border-border rounded-xl max-w-[480px] w-full mx-4 p-5">
            <h3 className="text-lg font-semibold text-foreground mb-2">Backup Codes</h3>
            <p className="text-body-sm text-muted-foreground mb-4">
              Save these in a secure location. Each code can only be used once.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {backupCodes.map((code) => (
                <div
                  key={code}
                  className="bg-muted border border-border rounded-md p-2 text-center font-mono text-mono-sm text-foreground"
                >
                  {code}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setShowCodes(false)
                addToast({
                  title: 'Copied',
                  message: 'Backup codes copied to clipboard.',
                  type: 'success',
                })
              }}
              className="w-full px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
            >
              Copy All
            </button>
          </div>
        </div>
      )}

      {pwdModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setPwdModal(false)
            }}
            onClick={() => {
              setPwdModal(false)
            }}
          />
          <div className="relative bg-white border border-border rounded-xl max-w-[480px] w-full mx-4 p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Change Password</h3>
            <div className="space-y-3">
              <Input label="Current Password" type="password" />
              <Input label="New Password" type="password" />
              <Input label="Confirm New Password" type="password" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setPwdModal(false)
                }}
                className="px-4 py-2 rounded-md border border-border text-body-sm text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPwdModal(false)
                  addToast({
                    title: 'Password Updated',
                    message: 'Your password has been changed.',
                    type: 'success',
                  })
                }}
                className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SystemTab({ onChange }: { onChange: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
        <span className="text-body-sm text-red-700">
          System-wide settings affect all users. Changes are logged and may require restart.
        </span>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">SMS Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Monthly Budget (\u20B1)" defaultValue="50000" onChange={onChange} />
          <div>
            <span className="text-body-sm text-muted-foreground block mb-2">Primary Provider</span>
            <select
              className="w-full bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
              onChange={onChange}
            >
              <option>Semaphore</option>
              <option>Globe Labs</option>
            </select>
          </div>
          <Input label="Circuit Breaker Threshold" defaultValue="5 failures" onChange={onChange} />
        </div>
        <button
          onClick={() => {
            onChange()
          }}
          className="mt-4 px-4 py-2 rounded-md bg-muted text-foreground border border-border text-body-sm hover:bg-white transition-all"
        >
          Send Test SMS
        </button>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Incident Auto-Escalation</h3>
        <div className="space-y-3">
          <Toggle label="Enable auto-escalation" enabled={true} onToggle={onChange} />
          <Input label="Escalation threshold (hours)" defaultValue="24" onChange={onChange} />
          <Toggle label="Auto-notify NDRRMC" enabled={true} onToggle={onChange} />
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Data Retention</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="text-body-sm text-muted-foreground block mb-2">
              Audit Log Retention
            </span>
            <select
              className="w-full bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
              onChange={onChange}
            >
              <option>6 months</option>
              <option>1 year</option>
              <option>2 years</option>
              <option>5 years</option>
            </select>
          </div>
          <div>
            <span className="text-body-sm text-muted-foreground block mb-2">
              Incident Data Retention
            </span>
            <select
              className="w-full bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
              onChange={onChange}
            >
              <option>2 years</option>
              <option>3 years</option>
              <option>5 years</option>
              <option>10 years</option>
            </select>
          </div>
          <div>
            <span className="text-body-sm text-muted-foreground block mb-2">
              Citizen Data After Erasure
            </span>
            <select
              className="w-full bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
              onChange={onChange}
            >
              <option>Delete immediately</option>
              <option>Anonymize and retain for 2 years</option>
              <option>Anonymize and retain for 5 years</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Municipality Defaults</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Default Response Time Target" defaultValue="15:00" onChange={onChange} />
          <Input label="Min Responders per Municipality" defaultValue="5" onChange={onChange} />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onChange}
          className="px-4 py-2 rounded-md bg-muted text-foreground border border-border text-body-sm hover:bg-white transition-all inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Export System Config
        </button>
        <button
          onClick={onChange}
          className="px-4 py-2 rounded-md bg-muted text-foreground border border-border text-body-sm hover:bg-white transition-all inline-flex items-center gap-2"
        >
          <Settings className="w-4 h-4" /> View System Logs
        </button>
      </div>
    </div>
  )
}

function Input({
  label,
  type = 'text',
  defaultValue,
  onChange,
  readOnly,
}: {
  label: string
  type?: string
  defaultValue?: string
  onChange?: () => void
  readOnly?: boolean
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-2">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        readOnly={readOnly}
        onChange={onChange}
        className={cn(
          'w-full bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none',
          readOnly && 'opacity-60 cursor-not-allowed',
        )}
      />
    </div>
  )
}

function Toggle({
  label,
  enabled,
  onToggle,
  note,
}: {
  label: string
  enabled: boolean
  onToggle: () => void
  note?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-body-sm text-foreground">{label}</div>
        {note && <div className="text-xs text-muted-foreground/70">{note}</div>}
      </div>
      <button
        onClick={onToggle}
        className={cn(
          'w-10 h-5 rounded-full transition-colors relative',
          enabled ? 'bg-accent' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}
