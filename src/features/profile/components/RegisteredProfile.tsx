/**
 * RegisteredProfile Component
 *
 * Profile screen for authenticated users.
 * Displays user info, submitted reports, and settings.
 */

import { useState } from 'react'
import {
  UserCircle,
  MapPin,
  Mail,
  FileText,
  Settings,
  LogOut,
  Bell,
  Download,
  Trash2,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'
import { Button } from '@/shared/components/Button'
import { useNavigate } from 'react-router-dom'

type Tab = 'info' | 'reports' | 'settings'

export function RegisteredProfile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [selectedTab, setSelectedTab] = useState<Tab>('info')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Failed to log out:', error)
    }
  }

  const handleDownloadData = () => {
    // TODO: Implement data download functionality
    console.log('Download data clicked')
  }

  const handleDeleteAccount = () => {
    // TODO: Implement account deletion with confirmation
    console.log('Delete account clicked')
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
              <p className="text-xs text-gray-500 mt-1 capitalize">
                {user.role?.replace('_', ' ') || 'Citizen'}
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
          {selectedTab === 'reports' && <ReportsTab userId={user.uid} />}
          {selectedTab === 'settings' && (
            <SettingsTab
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={() => setNotificationsEnabled(!notificationsEnabled)}
              onDownloadData={handleDownloadData}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
        </div>

        {/* Logout button */}
        <div className="px-4 pb-4">
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
  user: any // Firebase User
}

function InfoTab({ user }: InfoTabProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4" data-testid="info-tab">
      <h2 className="text-lg font-semibold text-gray-900">Your Information</h2>

      <div className="space-y-3">
        <InfoItem label="Display Name" value={user.displayName || 'Not set'} />
        <InfoItem label="Email" value={user.email} />
        <InfoItem label="Role" value={user.role?.replace('_', ' ') || 'Citizen'} capitalize />
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
// Reports Tab Component
// ---------------------------------------------------------------------------

interface ReportsTabProps {
  userId: string
}

function ReportsTab({ userId }: ReportsTabProps) {
  // TODO: Fetch user's submitted reports
  const mockReports = [
    {
      id: 'report-1',
      incidentType: 'flood',
      status: 'verified',
      createdAt: Date.now() - 86400000, // 1 day ago
    },
    {
      id: 'report-2',
      incidentType: 'fire',
      status: 'pending',
      createdAt: Date.now() - 172800000, // 2 days ago
    },
  ]

  if (mockReports.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center" data-testid="reports-tab">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No reports yet</h3>
        <p className="text-gray-600 text-sm">You haven't submitted any reports yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4" data-testid="reports-tab">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Reports</h2>

      <div className="space-y-3">
        {mockReports.map((report) => {
          const incidentTypeFormatted = report.incidentType
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

          return (
            <div
              key={report.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              data-testid={`user-report-${report.id}`}
            >
              <div className="flex items-center gap-3">
                <FileText className="text-gray-400 w-5 h-5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {incidentTypeFormatted} Report
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    report.status === 'verified'
                      ? 'bg-green-100 text-green-800'
                      : report.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {report.status}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          )
        })}
      </div>
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
}

function SettingsTab({
  notificationsEnabled,
  onToggleNotifications,
  onDownloadData,
  onDeleteAccount,
}: SettingsTabProps) {
  return (
    <div className="space-y-4" data-testid="settings-tab">
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
