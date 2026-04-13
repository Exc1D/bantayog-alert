/**
 * RegisteredProfile Component
 *
 * Profile screen for authenticated users.
 * Displays user info, submitted reports, and settings.
 */

import { useState } from 'react'
import {
  UserCircle,
  FileText,
  Settings,
  LogOut,
  Bell,
  Download,
  Trash2,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/shared/hooks/useAuth'
import { Button } from '@/shared/components/Button'
import {
  exportUserData,
  deleteUserAccount,
} from '../services/profile.service'
import { useReportQueue } from '@/features/report/hooks/useReportQueue'
import { MyReportsList } from './MyReportsList'
import { User as FirebaseUser } from 'firebase/auth'

type Tab = 'info' | 'reports' | 'settings'

export function RegisteredProfile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [selectedTab, setSelectedTab] = useState<Tab>('info')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Offline queue state
  const { queueSize, isSyncing, syncQueue, hasPendingReports } = useReportQueue()
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const handleSyncNow = async () => {
    try {
      setSyncError(null)
      setSyncResult(null)
      const result = await syncQueue()
      setSyncResult(result)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to sync. Please try again.')
      console.error('[SYNC_ERROR]', error)
    }
  }

  const handleLogout = async () => {
    try {
      setLogoutError(null)
      await signOut()
      navigate('/login')
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Failed to log out. Please try again or close the browser.'
      setLogoutError(message)
      console.error('[LOGOUT_ERROR]', error)
    }
  }

  const handleDownloadData = async () => {
    if (!user) return
    try {
      setDownloadError(null)
      const exportData = await exportUserData(
        user.uid,
        user.email || '',
        'citizen', // Role would come from user profile
        user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now()
      )

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bantayog-data-${user.uid}-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download data. Please try again.'
      setDownloadError(message)
      console.error('[DOWNLOAD_ERROR]', error)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    try {
      setDeleteError(null)
      await deleteUserAccount(user.uid)
      // User deleted, redirect to login
      navigate('/login')
    } catch (error) {
      // Check for Firebase auth error code
      const code = (error as { code?: string })?.code
      if (code === 'auth/requires-recent-login') {
        setDeleteError('For security, please log out and log back in before deleting your account.')
      } else {
        setDeleteError(error instanceof Error ? error.message : 'Failed to delete account')
      }
    }
  }

  if (!user) {
    return null // Should not happen if route is protected
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20" data-testid="registered-profile">
      <div className="max-w-lg mx-auto bg-gray-50 min-h-screen">
        {/* Header with user info */}
        <div className="bg-white border-b border-gray-200 px-4 py-6">
          <div className="flex items-center gap-4">
            <UserCircle className="text-gray-400" size={64} strokeWidth={1.5} />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                {user.displayName || 'Citizen Reporter'}
              </h1>
              <p className="text-sm text-gray-600">{user.email}</p>
              <p className="text-xs text-gray-500 mt-1">
                {user.emailVerified ? 'Verified' : 'Not Verified'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="bg-white border-b border-gray-200 px-4">
          <div className="flex gap-4">
            <TabButton
              label="Your Info"
              icon={UserCircle}
              active={selectedTab === 'info'}
              onClick={() => setSelectedTab('info')}
            />
            <TabButton
              label="Your Reports"
              icon={FileText}
              active={selectedTab === 'reports'}
              onClick={() => setSelectedTab('reports')}
            />
            <TabButton
              label="Settings"
              icon={Settings}
              active={selectedTab === 'settings'}
              onClick={() => setSelectedTab('settings')}
            />
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4">
          {selectedTab === 'info' && <InfoTab user={user} />}
          {selectedTab === 'reports' && (
            <MyReportsList userId={user.uid} />
          )}
          {selectedTab === 'settings' && (
            <SettingsTab
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={() => setNotificationsEnabled(!notificationsEnabled)}
              onDownloadData={handleDownloadData}
              onDeleteAccount={() => setShowDeleteConfirm(true)}
              deleteError={deleteError}
              downloadError={downloadError}
              hasPendingReports={hasPendingReports}
              queueSize={queueSize}
              isSyncing={isSyncing}
              onSyncNow={handleSyncNow}
              syncResult={syncResult}
              syncError={syncError}
            />
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Account?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This will permanently delete your account and all associated data. This action cannot be undone.
                </p>
                {deleteError && (
                  <p className="text-sm text-red-600 mb-4" role="alert">
                    {deleteError}
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleDeleteAccount}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logout button */}
        <div className="px-4 pb-4">
          {logoutError && (
            <p className="text-sm text-red-600 mb-2" role="alert">
              {logoutError}
            </p>
          )}
          <Button
            variant="secondary"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab Button Component
// ---------------------------------------------------------------------------

interface TabButtonProps {
  label: string
  icon: React.ElementType
  active: boolean
  onClick: () => void
}

function TabButton({ label, icon: Icon, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-primary-blue text-primary-blue font-medium'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
      data-testid={`tab-${label.toLowerCase().replace(' ', '-')}`}
    >
      <Icon size={18} />
      <span className="text-sm">{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Info Tab Component
// ---------------------------------------------------------------------------

interface InfoTabProps {
  user: FirebaseUser
}

function InfoTab({ user }: InfoTabProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4" data-testid="info-tab">
      <h2 className="text-lg font-semibold text-gray-900">Your Information</h2>

      <div className="space-y-3">
        <InfoItem label="Display Name" value={user.displayName || 'Not set'} />
        <InfoItem label="Email" value={user.email || 'Not set'} />
        <InfoItem
          label="Email Verified"
          value={user.emailVerified ? 'Yes' : 'No'}
          valueClassName={user.emailVerified ? 'text-green-600' : 'text-orange-600'}
        />
        <InfoItem label="Account Created" value={new Date(user.metadata?.creationTime || Date.now()).toLocaleDateString()} />
      </div>

      {/* Note about location info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Location information (barangay, municipality) is not stored in your
          profile. It is only collected when you submit a report.
        </p>
      </div>
    </div>
  )
}

interface InfoItemProps {
  label: string
  value: string
  valueClassName?: string
}

function InfoItem({ label, value, valueClassName = 'text-gray-900' }: InfoItemProps) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-medium ${valueClassName}`}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings Tab Component
// ---------------------------------------------------------------------------

interface SettingsTabProps {
  notificationsEnabled: boolean
  onToggleNotifications: () => void
  onDownloadData: () => void
  onDeleteAccount: () => void
  deleteError?: string | null
  downloadError?: string | null
  hasPendingReports?: boolean
  queueSize?: number
  isSyncing?: boolean
  onSyncNow?: () => void
  syncResult?: { success: number; failed: number } | null
  syncError?: string | null
}

function SettingsTab({
  notificationsEnabled,
  onToggleNotifications,
  onDownloadData,
  onDeleteAccount,
  deleteError,
  downloadError,
  hasPendingReports = false,
  queueSize = 0,
  isSyncing = false,
  onSyncNow,
  syncResult,
  syncError,
}: SettingsTabProps) {
  return (
    <div className="space-y-4" data-testid="settings-tab">
      {/* Offline Queue Sync section */}
      {hasPendingReports && (
        <div className="bg-yellow-50 rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-yellow-900">Pending Reports</h2>
            {syncResult && (
              <span className="text-xs text-yellow-700">
                Last sync: {syncResult.success} synced, {syncResult.failed} failed
              </span>
            )}
          </div>
          <p className="text-sm text-yellow-800 mb-3">
            {queueSize} report{queueSize > 1 ? 's' : ''} waiting to sync
          </p>
          <button
            onClick={onSyncNow}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-yellow-700 transition-colors"
            data-testid="sync-now-button"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Sync Now</span>
              </>
            )}
          </button>
          {syncError && (
            <p className="text-sm text-red-600 mt-2" role="alert">
              {syncError}
            </p>
          )}
        </div>
      )}

      {/* Notifications section */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="text-gray-600 w-5 h-5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Push Notifications</p>
              <p className="text-xs text-gray-600">Receive alerts about your reports</p>
            </div>
          </div>
          <button
            onClick={onToggleNotifications}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              notificationsEnabled ? 'bg-primary-blue' : 'bg-gray-200'
            }`}
            data-testid="notifications-toggle"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Data management section */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h2>

        {(downloadError || deleteError) && (
          <div className="mb-4 space-y-2">
            {downloadError && (
              <p className="text-sm text-red-600" role="alert">
                {downloadError}
              </p>
            )}
            {deleteError && (
              <p className="text-sm text-red-600" role="alert">
                {deleteError}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <SettingItem
            icon={Download}
            label="Download Your Data"
            description="Get a copy of all your data"
            onClick={onDownloadData}
            testId="download-data"
          />
          <SettingItem
            icon={Trash2}
            label="Delete Account"
            description="Permanently delete your account and data"
            onClick={onDeleteAccount}
            testId="delete-account"
            variant="danger"
          />
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <a
            href="/privacy-policy"
            className="text-sm text-primary-blue underline hover:text-blue-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Privacy Policy
          </a>
        </div>
      </div>

      {/* Privacy note */}
      <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          <strong>Privacy Note:</strong> Your data is stored securely and only used for disaster
          response purposes. You can request deletion at any time.
        </p>
      </div>
    </div>
  )
}

interface SettingItemProps {
  icon: React.ElementType
  label: string
  description: string
  onClick: () => void
  testId: string
  variant?: 'default' | 'danger'
}

function SettingItem({
  icon: Icon,
  label,
  description,
  onClick,
  testId,
  variant = 'default',
}: SettingItemProps) {
  const textColor = variant === 'danger' ? 'text-red-600' : 'text-gray-900'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${textColor}`} />
        <div className="text-left">
          <p className={`text-sm font-medium ${textColor}`}>{label}</p>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
    </button>
  )
}
