import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { Bell, Keyboard, LogOut, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const { notifications } = useDataStore()
  const { setGlobalSearchOpen } = useUIStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <header className="fixed top-0 left-0 right-0 h-[56px] bg-white border-b border-border z-50 flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <BantayogLogo className="w-8 h-8" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground leading-tight">
            Bantayog Alert
          </span>
          <span className="text-xs text-purple-700 font-medium">Superadmin</span>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground flex-1 justify-center">
        <KeyHint keyName="D" label="Dashboard" />
        <span className="text-muted-foreground/40">·</span>
        <KeyHint keyName="M" label="Map" />
        <span className="text-muted-foreground/40">·</span>
        <KeyHint keyName="U" label="Users" />
        <span className="text-muted-foreground/40">·</span>
        <KeyHint keyName="A" label="Emergency" />
        <span className="text-muted-foreground/40">·</span>
        <KeyHint keyName="N" label="NDRRMC" />
        <span className="text-muted-foreground/40">·</span>
        <KeyHint keyName="R" label="Reports" />
        <span className="text-muted-foreground/40">·</span>
        <KeyHint keyName="S" label="Settings" />
        <span className="text-muted-foreground/40">·</span>
        <KeyHint keyName="Esc" label="Close" />
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Search */}
        <button
          onClick={() => {
            setGlobalSearchOpen(true)
          }}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifs(!showNotifs)
            }}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-border rounded-lg shadow-lg z-[300]">
              <div className="p-3 border-b border-border">
                <p className="text-sm font-medium text-foreground">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'p-3 border-b border-border hover:bg-muted/50',
                        !n.read && 'bg-blue-50/30',
                      )}
                    >
                      <p className="text-xs font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu)
            }}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-muted transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-xs font-medium text-white">
              RC
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border rounded-lg shadow-lg z-[300]">
              <div className="p-3 border-b border-border">
                <p className="text-sm font-medium text-foreground">Engr. Ricardo Cruz</p>
                <p className="text-xs text-muted-foreground">Superadmin</p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false)
                }}
                className="w-full flex items-center gap-2 p-3 text-sm text-red-700 hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function KeyHint({ keyName, label }: { keyName: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono text-muted-foreground">
        {keyName}
      </kbd>
      <span>{label}</span>
    </span>
  )
}

function BantayogLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" stroke="#d64933" strokeWidth="2" />
      <path d="M16 6L16 16" stroke="#d64933" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 16L10 22" stroke="#d64933" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 16L22 22" stroke="#d64933" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3" fill="#d64933" />
      <path
        d="M8 10L12 12"
        stroke="#d64933"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M24 10L20 12"
        stroke="#d64933"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  )
}
